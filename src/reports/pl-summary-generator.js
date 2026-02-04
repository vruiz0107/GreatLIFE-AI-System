const ExcelJS = require('exceljs');
const db = require('../database/connection');
const path = require('path');

async function generatePLSummary(companyFileId, periodStart, periodEnd, previousYearStart, previousYearEnd) {
  console.log(`\n📊 Generating P&L Summary Report...`);
  console.log(`   Company ID: ${companyFileId}`);
  console.log(`   Period: ${periodStart} to ${periodEnd}`);
  console.log(`   Previous Year: ${previousYearStart} to ${previousYearEnd}\n`);

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

    // Get current year P&L data
    const currentYearData = await db.query(`
      SELECT 
        a.account_number,
        a.account_name,
        a.account_type,
        a.department_code,
        COALESCE(SUM(pl.amount), 0) as amount
      FROM accounts a
      LEFT JOIN pl_data pl ON a.id = pl.account_id 
        AND pl.period_start >= $1 
        AND pl.period_end <= $2
      WHERE a.company_file_id = $3
        AND a.account_type IN ('Income', 'Cost of Goods Sold', 'Expense', 'Other Income', 'Other Expense')
      GROUP BY a.id, a.account_number, a.account_name, a.account_type, a.department_code
      ORDER BY a.account_number
    `, [periodStart, periodEnd, companyFileId]);

    // Get previous year P&L data
    const previousYearData = await db.query(`
      SELECT 
        a.account_number,
        COALESCE(SUM(pl.amount), 0) as amount
      FROM accounts a
      LEFT JOIN pl_data pl ON a.id = pl.account_id 
        AND pl.period_start >= $1 
        AND pl.period_end <= $2
      WHERE a.company_file_id = $3
        AND a.account_type IN ('Income', 'Cost of Goods Sold', 'Expense', 'Other Income', 'Other Expense')
      GROUP BY a.id, a.account_number
      ORDER BY a.account_number
    `, [previousYearStart, previousYearEnd, companyFileId]);

    // Create a map for previous year data
    const prevYearMap = {};
    previousYearData.rows.forEach(row => {
      prevYearMap[row.account_number] = parseFloat(row.amount);
    });

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('P&L Summary');

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
    worksheet.getCell('A1').value = `${companyName} - Profit & Loss`;
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    // Add date range
    worksheet.mergeCells('A2:E2');
    worksheet.getCell('A2').value = `${periodStart} to ${periodEnd}`;
    worksheet.getCell('A2').font = { size: 12 };
    worksheet.getCell('A2').alignment = { horizontal: 'center' };

    // Add blank row
    worksheet.addRow([]);

    // Add headers
    const headerRow = worksheet.addRow([
      'Account',
      'Current Period',
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
      'Income': [],
      'Cost of Goods Sold': [],
      'Expense': [],
      'Other Income': [],
      'Other Expense': []
    };

    currentYearData.rows.forEach(row => {
      const accountType = row.account_type;
      if (accountsByType[accountType]) {
        accountsByType[accountType].push(row);
      }
    });

    let totalIncome = 0;
    let totalCOGS = 0;
    let totalExpense = 0;
    let totalOtherIncome = 0;
    let totalOtherExpense = 0;

    // INCOME SECTION
    if (accountsByType['Income'].length > 0) {
      const incomeHeaderRow = worksheet.addRow(['INCOME']);
      incomeHeaderRow.font = { bold: true, size: 12 };
      incomeHeaderRow.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      accountsByType['Income'].forEach(account => {
        const currentAmount = parseFloat(account.amount);
        const prevAmount = prevYearMap[account.account_number] || 0;
        const change = currentAmount - prevAmount;
        const percentChange = prevAmount !== 0 ? (change / prevAmount) * 100 : 0;

        const row = worksheet.addRow([
          `  ${account.account_name}`,
          currentAmount,
          prevAmount,
          change,
          percentChange / 100
        ]);

        row.getCell(2).numFmt = '$#,##0.00;[Red]($#,##0.00)';
        row.getCell(3).numFmt = '$#,##0.00;[Red]($#,##0.00)';
        row.getCell(4).numFmt = '$#,##0.00;[Red]($#,##0.00)';
        row.getCell(5).numFmt = '0.00%;[Red](0.00%)';

        totalIncome += currentAmount;
      });

      const totalIncomeRow = worksheet.addRow([
        'Total Income',
        totalIncome,
        '', '', ''
      ]);
      totalIncomeRow.font = { bold: true };
      totalIncomeRow.getCell(2).numFmt = '$#,##0.00;[Red]($#,##0.00)';
      worksheet.addRow([]);
    }

    // COST OF GOODS SOLD
    if (accountsByType['Cost of Goods Sold'].length > 0) {
      const cogsHeaderRow = worksheet.addRow(['COST OF GOODS SOLD']);
      cogsHeaderRow.font = { bold: true, size: 12 };
      cogsHeaderRow.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      accountsByType['Cost of Goods Sold'].forEach(account => {
        const currentAmount = parseFloat(account.amount);
        const prevAmount = prevYearMap[account.account_number] || 0;
        const change = currentAmount - prevAmount;
        const percentChange = prevAmount !== 0 ? (change / prevAmount) * 100 : 0;

        const row = worksheet.addRow([
          `  ${account.account_name}`,
          currentAmount,
          prevAmount,
          change,
          percentChange / 100
        ]);

        row.getCell(2).numFmt = '$#,##0.00;[Red]($#,##0.00)';
        row.getCell(3).numFmt = '$#,##0.00;[Red]($#,##0.00)';
        row.getCell(4).numFmt = '$#,##0.00;[Red]($#,##0.00)';
        row.getCell(5).numFmt = '0.00%;[Red](0.00%)';

        totalCOGS += currentAmount;
      });

      const totalCOGSRow = worksheet.addRow([
        'Total Cost of Goods Sold',
        totalCOGS,
        '', '', ''
      ]);
      totalCOGSRow.font = { bold: true };
      totalCOGSRow.getCell(2).numFmt = '$#,##0.00;[Red]($#,##0.00)';
      worksheet.addRow([]);
    }

    // GROSS PROFIT
    const grossProfit = totalIncome - totalCOGS;
    const grossProfitRow = worksheet.addRow([
      'GROSS PROFIT',
      grossProfit,
      '', '', ''
    ]);
    grossProfitRow.font = { bold: true, size: 12 };
    grossProfitRow.getCell(2).numFmt = '$#,##0.00;[Red]($#,##0.00)';
    grossProfitRow.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFEB9C' }
    };
    worksheet.addRow([]);

    // EXPENSES
    if (accountsByType['Expense'].length > 0) {
      const expenseHeaderRow = worksheet.addRow(['EXPENSES']);
      expenseHeaderRow.font = { bold: true, size: 12 };
      expenseHeaderRow.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      accountsByType['Expense'].forEach(account => {
        const currentAmount = parseFloat(account.amount);
        const prevAmount = prevYearMap[account.account_number] || 0;
        const change = currentAmount - prevAmount;
        const percentChange = prevAmount !== 0 ? (change / prevAmount) * 100 : 0;

        const row = worksheet.addRow([
          `  ${account.account_name}`,
          currentAmount,
          prevAmount,
          change,
          percentChange / 100
        ]);

        row.getCell(2).numFmt = '$#,##0.00;[Red]($#,##0.00)';
        row.getCell(3).numFmt = '$#,##0.00;[Red]($#,##0.00)';
        row.getCell(4).numFmt = '$#,##0.00;[Red]($#,##0.00)';
        row.getCell(5).numFmt = '0.00%;[Red](0.00%)';

        totalExpense += currentAmount;
      });

      const totalExpenseRow = worksheet.addRow([
        'Total Expenses',
        totalExpense,
        '', '', ''
      ]);
      totalExpenseRow.font = { bold: true };
      totalExpenseRow.getCell(2).numFmt = '$#,##0.00;[Red]($#,##0.00)';
      worksheet.addRow([]);
    }

    // NET OPERATING INCOME
    const netOperatingIncome = grossProfit - totalExpense;
    const noiRow = worksheet.addRow([
      'NET OPERATING INCOME',
      netOperatingIncome,
      '', '', ''
    ]);
    noiRow.font = { bold: true, size: 12 };
    noiRow.getCell(2).numFmt = '$#,##0.00;[Red]($#,##0.00)';
    noiRow.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFEB9C' }
    };
    worksheet.addRow([]);

    // OTHER INCOME/EXPENSE (if any)
    if (accountsByType['Other Income'].length > 0 || accountsByType['Other Expense'].length > 0) {
      const otherHeaderRow = worksheet.addRow(['OTHER INCOME/EXPENSE']);
      otherHeaderRow.font = { bold: true, size: 12 };
      otherHeaderRow.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      [...accountsByType['Other Income'], ...accountsByType['Other Expense']].forEach(account => {
        const currentAmount = parseFloat(account.amount);
        const prevAmount = prevYearMap[account.account_number] || 0;
        const change = currentAmount - prevAmount;
        const percentChange = prevAmount !== 0 ? (change / prevAmount) * 100 : 0;

        const row = worksheet.addRow([
          `  ${account.account_name}`,
          currentAmount,
          prevAmount,
          change,
          percentChange / 100
        ]);

        row.getCell(2).numFmt = '$#,##0.00;[Red]($#,##0.00)';
        row.getCell(3).numFmt = '$#,##0.00;[Red]($#,##0.00)';
        row.getCell(4).numFmt = '$#,##0.00;[Red]($#,##0.00)';
        row.getCell(5).numFmt = '0.00%;[Red](0.00%)';

        if (account.account_type === 'Other Income') {
          totalOtherIncome += currentAmount;
        } else {
          totalOtherExpense += currentAmount;
        }
      });

      worksheet.addRow([]);
    }

    // NET INCOME
    const netIncome = netOperatingIncome + totalOtherIncome - totalOtherExpense;
    const netIncomeRow = worksheet.addRow([
      'NET INCOME',
      netIncome,
      '', '', ''
    ]);
    netIncomeRow.font = { bold: true, size: 14 };
    netIncomeRow.getCell(2).numFmt = '$#,##0.00;[Red]($#,##0.00)';
    netIncomeRow.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF90EE90' }
    };

    // Save file
    const outputDir = path.join(__dirname, '../../output');
    const fs = require('fs');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = `PL_Summary_${companyName.replace(/\s+/g, '_')}_${periodStart}_to_${periodEnd}.xlsx`;
    const filepath = path.join(outputDir, filename);
    
    await workbook.xlsx.writeFile(filepath);

    console.log(`✅ P&L Summary generated: ${filepath}\n`);
    console.log(`   Total Income: $${totalIncome.toFixed(2)}`);
    console.log(`   Total COGS: $${totalCOGS.toFixed(2)}`);
    console.log(`   Gross Profit: $${grossProfit.toFixed(2)}`);
    console.log(`   Total Expenses: $${totalExpense.toFixed(2)}`);
    console.log(`   Net Operating Income: $${netOperatingIncome.toFixed(2)}`);
    console.log(`   Net Income: $${netIncome.toFixed(2)}\n`);

    return filepath;

  } catch (error) {
    console.error('❌ Error generating P&L summary:', error);
    throw error;
  }
}

module.exports = { generatePLSummary };