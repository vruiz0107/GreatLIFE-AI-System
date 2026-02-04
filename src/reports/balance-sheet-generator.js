const ExcelJS = require('exceljs');
const db = require('../database/connection');
const path = require('path');

async function generateBalanceSheet(companyFileId, reportDate, previousYearDate) {
  console.log(`\n📊 Generating Balance Sheet Report...`);
  console.log(`   Company ID: ${companyFileId}`);
  console.log(`   Report Date: ${reportDate}`);
  console.log(`   Previous Year: ${previousYearDate}\n`);

  try {
    // Get company info
    const companyResult = await db.query(
      'SELECT company_name FROM company_files WHERE id = $1',
      [companyFileId]
    );
    
    if (companyResult.rows.length === 0) {
      throw new Error(`Company file ${companyFileId} not found`);
    }
    
    const companyName = companyResult.rows[0].company_name;

    // Get current year balance sheet data
    const currentYearData = await db.query(`
      SELECT 
        a.account_number,
        a.account_name,
        a.account_type,
        a.department_code,
        COALESCE(bs.amount, 0) as amount
      FROM accounts a
      LEFT JOIN balance_sheet_data bs ON a.id = bs.account_id AND bs.report_date = $1
      WHERE a.company_file_id = $2
        AND a.account_type IN ('Bank', 'Other Current Asset', 'Fixed Asset', 
                               'Other Asset', 'Accounts Payable', 'Credit Card',
                               'Other Current Liability', 'Long Term Liability', 'Equity')
      ORDER BY a.account_number
    `, [reportDate, companyFileId]);

    // Get previous year balance sheet data
    const previousYearData = await db.query(`
      SELECT 
        a.account_number,
        COALESCE(bs.amount, 0) as amount
      FROM accounts a
      LEFT JOIN balance_sheet_data bs ON a.id = bs.account_id AND bs.report_date = $1
      WHERE a.company_file_id = $2
        AND a.account_type IN ('Bank', 'Other Current Asset', 'Fixed Asset', 
                               'Other Asset', 'Accounts Payable', 'Credit Card',
                               'Other Current Liability', 'Long Term Liability', 'Equity')
      ORDER BY a.account_number
    `, [previousYearDate, companyFileId]);

    // Create a map for previous year data
    const prevYearMap = {};
    previousYearData.rows.forEach(row => {
      prevYearMap[row.account_number] = parseFloat(row.amount);
    });

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Balance Sheet');

    // Set column widths
    worksheet.columns = [
      { width: 40 }, // Account Name
      { width: 15 }, // Current Year
      { width: 15 }, // Previous Year
      { width: 15 }, // $ Change
      { width: 12 }  // % Change
    ];

    // Add title
    worksheet.mergeCells('A1:E1');
    worksheet.getCell('A1').value = `${companyName} - Balance Sheet`;
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    // Add date
    worksheet.mergeCells('A2:E2');
    worksheet.getCell('A2').value = `As of ${reportDate}`;
    worksheet.getCell('A2').font = { size: 12 };
    worksheet.getCell('A2').alignment = { horizontal: 'center' };

    // Add blank row
    worksheet.addRow([]);

    // Add headers
    const headerRow = worksheet.addRow([
      'Account',
      'Current Year',
      'Previous Year',
      '$ Change',
      '% Change'
    ]);
    
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    };

    // Group accounts by type
    const accountsByType = {
      'Assets': [],
      'Liabilities': [],
      'Equity': []
    };

    currentYearData.rows.forEach(row => {
      const accountType = row.account_type;
      
      if (['Bank', 'Other Current Asset', 'Fixed Asset', 'Other Asset'].includes(accountType)) {
        accountsByType['Assets'].push(row);
      } else if (['Accounts Payable', 'Credit Card', 'Other Current Liability', 'Long Term Liability'].includes(accountType)) {
        accountsByType['Liabilities'].push(row);
      } else if (accountType === 'Equity') {
        accountsByType['Equity'].push(row);
      }
    });

    // Add data rows by category
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;

    for (const [category, accounts] of Object.entries(accountsByType)) {
      // Add category header
      const categoryRow = worksheet.addRow([category]);
      categoryRow.font = { bold: true, size: 12 };
      categoryRow.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      let categoryTotal = 0;

      // Add account rows
      accounts.forEach(account => {
        const currentAmount = parseFloat(account.amount);
        const prevAmount = prevYearMap[account.account_number] || 0;
        const change = currentAmount - prevAmount;
        const percentChange = prevAmount !== 0 ? (change / prevAmount) * 100 : 0;

        const row = worksheet.addRow([
          `  ${account.account_name}`,
          currentAmount,
          prevAmount,
          change,
          percentChange / 100 // Excel will format as percentage
        ]);

        // Format currency columns
        row.getCell(2).numFmt = '$#,##0.00;[Red]($#,##0.00)';
        row.getCell(3).numFmt = '$#,##0.00;[Red]($#,##0.00)';
        row.getCell(4).numFmt = '$#,##0.00;[Red]($#,##0.00)';
        row.getCell(5).numFmt = '0.00%;[Red](0.00%)';

        categoryTotal += currentAmount;
      });

      // Add category total
      const totalRow = worksheet.addRow([
        `Total ${category}`,
        categoryTotal,
        '', '', ''
      ]);
      totalRow.font = { bold: true };
      totalRow.getCell(2).numFmt = '$#,##0.00;[Red]($#,##0.00)';

      // Track totals
      if (category === 'Assets') totalAssets = categoryTotal;
      if (category === 'Liabilities') totalLiabilities = categoryTotal;
      if (category === 'Equity') totalEquity = categoryTotal;

      // Add blank row
      worksheet.addRow([]);
    }

    // Add grand total (Assets = Liabilities + Equity check)
    worksheet.addRow([]);
    const grandTotalRow = worksheet.addRow([
      'Total Liabilities & Equity',
      totalLiabilities + totalEquity,
      '', '', ''
    ]);
    grandTotalRow.font = { bold: true, size: 12 };
    grandTotalRow.getCell(2).numFmt = '$#,##0.00;[Red]($#,##0.00)';

    // Save file
    const outputDir = path.join(__dirname, '../../output');
    const fs = require('fs');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = `Balance_Sheet_${companyName.replace(/\s+/g, '_')}_${reportDate}.xlsx`;
    const filepath = path.join(outputDir, filename);
    
    await workbook.xlsx.writeFile(filepath);

    console.log(`✅ Balance Sheet generated: ${filepath}\n`);
    console.log(`   Total Assets: $${totalAssets.toFixed(2)}`);
    console.log(`   Total Liabilities: $${totalLiabilities.toFixed(2)}`);
    console.log(`   Total Equity: $${totalEquity.toFixed(2)}`);
    console.log(`   Balance Check: ${Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01 ? '✅ Balanced' : '❌ Out of Balance'}\n`);

    return filepath;

  } catch (error) {
    console.error('❌ Error generating balance sheet:', error);
    throw error;
  }
}

module.exports = { generateBalanceSheet };