const ExcelJS = require('exceljs');
const db = require('../database/connection');
const path = require('path');

async function generatePLDetail(companyFileId, periodStart, periodEnd, previousYearStart, previousYearEnd) {
  console.log(`\n📊 Generating P&L Detail Report...`);
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

    // Get current year P&L data with YTD
    const currentYearData = await db.query(`
      SELECT 
        a.account_number,
        a.account_name,
        a.account_type,
        a.department_code,
        a.description,
        COALESCE(SUM(CASE 
          WHEN pl.period_start >= $1 AND pl.period_end <= $2 
          THEN pl.amount 
          ELSE 0 
        END), 0) as period_amount,
        COALESCE(SUM(pl.amount), 0) as ytd_amount
      FROM accounts a
      LEFT JOIN pl_data pl ON a.id = pl.account_id 
        AND EXTRACT(YEAR FROM pl.period_start) = EXTRACT(YEAR FROM $1::date)
      WHERE a.company_file_id = $3
        AND a.account_type IN ('Income', 'Cost of Goods Sold', 'Expense', 'Other Income', 'Other Expense')
      GROUP BY a.id, a.account_number, a.account_name, a.account_type, a.department_code, a.description
      ORDER BY a.account_number
    `, [periodStart, periodEnd, companyFileId]);

    // Get previous year same period data
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
    const worksheet = workbook.addWorksheet('P&L Detail');

    // Set column widths
    worksheet.columns = [
      { width: 45 }, // Account Name
      { width: 15 }, // Period Actual
      { width: 15 }, // Previous Year
      { width: 15 }, // $ Change
      { width: 12 }, // % Change
      { width: 15 }  // YTD Total
    ];

    // Add title
    worksheet.mergeCells('A1:F1');
    worksheet.getCell('A1').value = `${companyName} - Profit & Loss Detail`;
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    // Add date range
    worksheet.mergeCells('A2:F2');
    worksheet.getCell('A2').value = `${periodStart} to ${periodEnd}`;
    worksheet.getCell('A2').font = { size: 12 };
    worksheet.getCell('A2').alignment = { horizontal: 'center' };

    // Add blank row
    worksheet.addRow([]);

    // Add headers
    const headerRow = worksheet.addRow([
      'Account',
      'Period Actual',
      'Prev Year',
      '$ Change',
      '% Change',
      'YTD Total'
    ]);
    
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    };

    // Group accounts by type and parent
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
    let totalIncomeYTD = 0;
    let totalCOGS = 0;
    let totalCOGSYTD = 0;
    let totalExpense = 0;
    let totalExpenseYTD = 0;
    let totalOtherIncome = 0;
    let totalOtherIncomeYTD = 0;
    let totalOtherExpense = 0;
    let totalOtherExpenseYTD = 0;

    // Helper function to add account rows
    const addAccountSection = (sectionName, accounts, totals) => {
      if (accounts.length === 0) return;

      const sectionHeaderRow = worksheet.addRow([sectionName]);
      sectionHeaderRow.font = { bold: true, size: 12 };
      sectionHeaderRow.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      let sectionTotal = 0;
      let sectionYTD = 0;

      // Group by parent account
      const parentGroups = {};
      accounts.forEach(account => {
        const parent = account.description?.includes('Parent:') 
          ? account.description.replace('Parent: ', '').trim()
          : 'Other';
        
        if (!parentGroups[parent]) {
          parentGroups[parent] = [];
        }
        parentGroups[parent].push(account);
      });

      // Add accounts grouped by parent
      Object.entries(parentGroups).forEach(([parent, groupAccounts]) => {
        // Add parent header if not "Other"
        if (parent !== 'Other' && groupAccounts.length > 1) {
          const parentRow = worksheet.addRow([`  ${parent}`]);
          parentRow.font = { bold: true, italic: true };
        }

        groupAccounts.forEach(account => {
          const periodAmount = parseFloat(account.period_amount);
          const ytdAmount = parseFloat(account.ytd_amount);
          const prevAmount = prevYearMap[account.account_number] || 0;
          const change = periodAmount - prevAmount;
          const percentChange = prevAmount !== 0 ? (change / prevAmount) * 100 : 0;

          const indent = parent !== 'Other' && groupAccounts.length > 1 ? '    ' : '  ';
          
          const row = worksheet.addRow([
            `${indent}${account.account_name}`,
            periodAmount,
            prevAmount,
            change,
            percentChange / 100,
            ytdAmount
          ]);

          row.getCell(2).numFmt = '$#,##0.00;[Red]($#,##0.00)';
          row.getCell(3).numFmt = '$#,##0.00;[Red]($#,##0.00)';
          row.getCell(4).numFmt = '$#,##0.00;[Red]($#,##0.00)';
          row.getCell(5).numFmt = '0.00%;[Red](0.00%)';
          row.getCell(6).numFmt = '$#,##0.00;[Red]($#,##0.00)';

          sectionTotal += periodAmount;
          sectionYTD += ytdAmount;
        });
      });

      // Add section total
      const totalRow = worksheet.addRow([
        `Total ${sectionName}`,
        sectionTotal,
        '', '', '',
        sectionYTD
      ]);
      totalRow.font = { bold: true };
      totalRow.getCell(2).numFmt = '$#,##0.00;[Red]($#,##0.00)';
      totalRow.getCell(6).numFmt = '$#,##0.00;[Red]($#,##0.00)';
      worksheet.addRow([]);

      totals.period = sectionTotal;
      totals.ytd = sectionYTD;
    };

    // INCOME
    const incomeTotals = { period: 0, ytd: 0 };
    addAccountSection('INCOME', accountsByType['Income'], incomeTotals);
    totalIncome = incomeTotals.period;
    totalIncomeYTD = incomeTotals.ytd;

    // COGS
    const cogsTotals = { period: 0, ytd: 0 };
    addAccountSection('COST OF GOODS SOLD', accountsByType['Cost of Goods Sold'], cogsTotals);
    totalCOGS = cogsTotals.period;
    totalCOGSYTD = cogsTotals.ytd;

    // GROSS PROFIT
    const grossProfit = totalIncome - totalCOGS;
    const grossProfitYTD = totalIncomeYTD - totalCOGSYTD;
    const grossProfitRow = worksheet.addRow([
      'GROSS PROFIT',
      grossProfit,
      '', '', '',
      grossProfitYTD
    ]);
    grossProfitRow.font = { bold: true, size: 12 };
    grossProfitRow.getCell(2).numFmt = '$#,##0.00;[Red]($#,##0.00)';
    grossProfitRow.getCell(6).numFmt = '$#,##0.00;[Red]($#,##0.00)';
    grossProfitRow.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFEB9C' }
    };
    worksheet.addRow([]);

    // EXPENSES
    const expenseTotals = { period: 0, ytd: 0 };
    addAccountSection('EXPENSES', accountsByType['Expense'], expenseTotals);
    totalExpense = expenseTotals.period;
    totalExpenseYTD = expenseTotals.ytd;

    // NET OPERATING INCOME
    const netOperatingIncome = grossProfit - totalExpense;
    const netOperatingIncomeYTD = grossProfitYTD - totalExpenseYTD;
    const noiRow = worksheet.addRow([
      'NET OPERATING INCOME',
      netOperatingIncome,
      '', '', '',
      netOperatingIncomeYTD
    ]);
    noiRow.font = { bold: true, size: 12 };
    noiRow.getCell(2).numFmt = '$#,##0.00;[Red]($#,##0.00)';
    noiRow.getCell(6).numFmt = '$#,##0.00;[Red]($#,##0.00)';
    noiRow.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFEB9C' }
    };
    worksheet.addRow([]);

    // OTHER INCOME/EXPENSE
    if (accountsByType['Other Income'].length > 0 || accountsByType['Other Expense'].length > 0) {
      const otherHeaderRow = worksheet.addRow(['OTHER INCOME/EXPENSE']);
      otherHeaderRow.font = { bold: true, size: 12 };
      otherHeaderRow.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      const otherIncomeTotals = { period: 0, ytd: 0 };
      const otherExpenseTotals = { period: 0, ytd: 0 };
      
      addAccountSection('Other Income', accountsByType['Other Income'], otherIncomeTotals);
      addAccountSection('Other Expense', accountsByType['Other Expense'], otherExpenseTotals);
      
      totalOtherIncome = otherIncomeTotals.period;
      totalOtherIncomeYTD = otherIncomeTotals.ytd;
      totalOtherExpense = otherExpenseTotals.period;
      totalOtherExpenseYTD = otherExpenseTotals.ytd;
    }

    // NET INCOME
    const netIncome = netOperatingIncome + totalOtherIncome - totalOtherExpense;
    const netIncomeYTD = netOperatingIncomeYTD + totalOtherIncomeYTD - totalOtherExpenseYTD;
    const netIncomeRow = worksheet.addRow([
      'NET INCOME',
      netIncome,
      '', '', '',
      netIncomeYTD
    ]);
    netIncomeRow.font = { bold: true, size: 14 };
    netIncomeRow.getCell(2).numFmt = '$#,##0.00;[Red]($#,##0.00)';
    netIncomeRow.getCell(6).numFmt = '$#,##0.00;[Red]($#,##0.00)';
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

    const filename = `PL_Detail_${companyName.replace(/\s+/g, '_')}_${periodStart}_to_${periodEnd}.xlsx`;
    const filepath = path.join(outputDir, filename);
    
    await workbook.xlsx.writeFile(filepath);

    console.log(`✅ P&L Detail generated: ${filepath}\n`);
    console.log(`   Period Net Income: $${netIncome.toFixed(2)}`);
    console.log(`   YTD Net Income: $${netIncomeYTD.toFixed(2)}\n`);

    return filepath;

  } catch (error) {
    console.error('❌ Error generating P&L detail:', error);
    throw error;
  }
}

module.exports = { generatePLDetail };