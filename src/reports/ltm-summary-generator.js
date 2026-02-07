const ExcelJS = require('exceljs');
const db = require('../database/connection');
const path = require('path');

async function generateLTMSummary(companyFileId, endDate) {
  console.log(`\n📊 Generating LTM Summary Report...`);
  console.log(`   Company ID: ${companyFileId}`);
  console.log(`   End Date: ${endDate}\n`);

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

    // Calculate 12 months of dates (going back from endDate)
    const months = [];
    const endDateObj = new Date(endDate);
    
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(endDateObj);
      monthDate.setMonth(monthDate.getMonth() - i);
      
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth() + 1;
      const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
      
      // Get last day of month
      const lastDay = new Date(year, month, 0).getDate();
      const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      
      months.push({
        label: monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        start: monthStart,
        end: monthEnd
      });
    }

    console.log(`   Generating data for months: ${months[0].label} to ${months[11].label}\n`);

    // Get P&L data for all 12 months
    const plData = await db.query(`
      SELECT 
        a.account_type,
        a.account_name,
        pl.period_start,
        pl.period_end,
        COALESCE(SUM(pl.amount), 0) as amount
      FROM accounts a
      LEFT JOIN pl_data pl ON a.id = pl.account_id
      WHERE a.company_file_id = $1
        AND a.account_type IN ('Income', 'Cost of Goods Sold', 'Expense', 'Other Income', 'Other Expense')
        AND pl.period_start >= $2
        AND pl.period_end <= $3
      GROUP BY a.account_type, a.account_name, pl.period_start, pl.period_end
      ORDER BY a.account_type, a.account_name
    `, [companyFileId, months[0].start, months[11].end]);

    // Organize data by month and account type
    const dataByMonth = {};
    months.forEach(month => {
      dataByMonth[month.label] = {
        income: 0,
        cogs: 0,
        expense: 0,
        otherIncome: 0,
        otherExpense: 0
      };
    });

    plData.rows.forEach(row => {
      const monthLabel = new Date(row.period_start).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      if (dataByMonth[monthLabel]) {
        const amount = parseFloat(row.amount);
        
        switch(row.account_type) {
          case 'Income':
            dataByMonth[monthLabel].income += amount;
            break;
          case 'Cost of Goods Sold':
            dataByMonth[monthLabel].cogs += amount;
            break;
          case 'Expense':
            dataByMonth[monthLabel].expense += amount;
            break;
          case 'Other Income':
            dataByMonth[monthLabel].otherIncome += amount;
            break;
          case 'Other Expense':
            dataByMonth[monthLabel].otherExpense += amount;
            break;
        }
      }
    });

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('LTM Summary');

    // Set column widths
    const columnWidths = [{ width: 30 }]; // Account name column
    months.forEach(() => columnWidths.push({ width: 15 })); // Month columns
    worksheet.columns = columnWidths;

    // Add title
    const titleCell = worksheet.getCell('A1');
    worksheet.mergeCells(1, 1, 1, months.length + 1);
    titleCell.value = `${companyName} - Last 12 Months Summary`;
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center' };

    // Add date range
    const dateCell = worksheet.getCell('A2');
    worksheet.mergeCells(2, 1, 2, months.length + 1);
    dateCell.value = `${months[0].label} to ${months[11].label}`;
    dateCell.font = { size: 12 };
    dateCell.alignment = { horizontal: 'center' };

    // Add blank row
    worksheet.addRow([]);

    // Add headers
    const headers = ['', ...months.map(m => m.label)];
    const headerRow = worksheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    };

    // Helper function to add data row
    const addDataRow = (label, monthlyData, isBold = false, backgroundColor = null) => {
      const rowData = [label];
      months.forEach(month => {
        rowData.push(monthlyData[month.label] || 0);
      });
      
      const row = worksheet.addRow(rowData);
      
      if (isBold) {
        row.font = { bold: true };
      }
      
      if (backgroundColor) {
        row.getCell(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: backgroundColor }
        };
      }
      
      // Format currency columns (columns 2 onwards)
      for (let i = 2; i <= months.length + 1; i++) {
        row.getCell(i).numFmt = '$#,##0.00;[Red]($#,##0.00)';
      }
      
      return row;
    };

    // INCOME
    const incomeHeaderRow = addDataRow('INCOME', {}, true, 'FFE0E0E0');
    
    const incomeData = {};
    months.forEach(month => {
      incomeData[month.label] = dataByMonth[month.label].income;
    });
    addDataRow('Total Income', incomeData, true);
    worksheet.addRow([]);

    // COST OF GOODS SOLD
    addDataRow('COST OF GOODS SOLD', {}, true, 'FFE0E0E0');
    
    const cogsData = {};
    months.forEach(month => {
      cogsData[month.label] = dataByMonth[month.label].cogs;
    });
    addDataRow('Total COGS', cogsData, true);
    worksheet.addRow([]);

    // GROSS PROFIT
    const grossProfitData = {};
    months.forEach(month => {
      grossProfitData[month.label] = dataByMonth[month.label].income - dataByMonth[month.label].cogs;
    });
    addDataRow('GROSS PROFIT', grossProfitData, true, 'FFFFEB9C');
    worksheet.addRow([]);

    // EXPENSES
    addDataRow('EXPENSES', {}, true, 'FFE0E0E0');
    
    const expenseData = {};
    months.forEach(month => {
      expenseData[month.label] = dataByMonth[month.label].expense;
    });
    addDataRow('Total Expenses', expenseData, true);
    worksheet.addRow([]);

    // NET OPERATING INCOME
    const noiData = {};
    months.forEach(month => {
      noiData[month.label] = grossProfitData[month.label] - dataByMonth[month.label].expense;
    });
    addDataRow('NET OPERATING INCOME', noiData, true, 'FFFFEB9C');
    worksheet.addRow([]);

    // OTHER INCOME/EXPENSE
    addDataRow('OTHER INCOME/EXPENSE', {}, true, 'FFE0E0E0');
    
    const otherIncomeData = {};
    const otherExpenseData = {};
    months.forEach(month => {
      otherIncomeData[month.label] = dataByMonth[month.label].otherIncome;
      otherExpenseData[month.label] = dataByMonth[month.label].otherExpense;
    });
    addDataRow('Other Income', otherIncomeData);
    addDataRow('Other Expense', otherExpenseData);
    worksheet.addRow([]);

    // NET INCOME
    const netIncomeData = {};
    months.forEach(month => {
      netIncomeData[month.label] = noiData[month.label] + 
                                    dataByMonth[month.label].otherIncome - 
                                    dataByMonth[month.label].otherExpense;
    });
    addDataRow('NET PROFIT (LOSS)', netIncomeData, true, 'FF90EE90');
    worksheet.addRow([]);

    // ADDITIONAL SECTIONS (Placeholder for real data)
    addDataRow('PRINCIPAL PAYMENTS', {}, true, 'FFE0E0E0');
    addDataRow('Equipment Principal', {});
    addDataRow('Mortgage Principal', {});
    worksheet.addRow([]);

    addDataRow('CAPITAL EXPENDITURES', {}, true, 'FFE0E0E0');
    addDataRow('Capital Expense', {});
    worksheet.addRow([]);

    // NET CASH (Net Income - Principal Payments - Cap Ex)
    // For now, same as Net Income since we don't have principal/capex data yet
    addDataRow('NET CASH', netIncomeData, true, 'FFFFCC99');

    // Save file
    const outputDir = path.join(__dirname, '../../output');
    const fs = require('fs');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = `LTM_Summary_${companyName.replace(/\s+/g, '_')}_${endDate}.xlsx`;
    const filepath = path.join(outputDir, filename);
    
    await workbook.xlsx.writeFile(filepath);

    console.log(`✅ LTM Summary generated: ${filepath}\n`);
    
    // Calculate 12-month totals
    let totalIncome = 0;
    let totalNetIncome = 0;
    months.forEach(month => {
      totalIncome += incomeData[month.label];
      totalNetIncome += netIncomeData[month.label];
    });
    
    console.log(`   12-Month Total Income: $${totalIncome.toFixed(2)}`);
    console.log(`   12-Month Net Income: $${totalNetIncome.toFixed(2)}\n`);

    return filepath;

  } catch (error) {
    console.error('❌ Error generating LTM summary:', error);
    throw error;
  }
}

module.exports = { generateLTMSummary };