const ExcelJS = require('exceljs');
const db = require('../database/connection');
const path = require('path');

async function generateLTMSummary(companyFileId, endDate) {
  console.log(`\n📊 Generating LTM Summary Report (Dynamic)...`);
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

    // Calculate 12 months of dates
    // End date is the report month (e.g., October 2025)
    // First data column should be NEXT month (e.g., November 2024)
    const endDateObj = new Date(endDate);
    const reportMonth = endDateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    const months = [];
    
    // Start with the month AFTER the end date and go back 11 more months
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
        label: monthDate.toLocaleDateString('en-US', { month: 'long' }), // Full month name, no year
        start: monthStart,
        end: monthEnd
      });
    }

    console.log(`   Report Month: ${reportMonth}`);
    console.log(`   Data range: ${months[0].label} to ${months[11].label}\n`);

    // Get ALL mapped account data for the 12-month period
    const mappedData = await db.query(`
      SELECT 
        am.report_section,
        am.report_line,
        a.account_number,
        a.account_name,
        pl.period_start,
        COALESCE(SUM(pl.amount), 0) as amount
      FROM account_mappings am
      JOIN accounts a ON am.account_number = a.account_number
      LEFT JOIN pl_data pl ON a.id = pl.account_id
        AND pl.period_start >= $1
        AND pl.period_end <= $2
      WHERE am.report_name = 'LTM_SUMMARY'
        AND a.company_file_id = $3
      GROUP BY am.report_section, am.report_line, a.account_number, a.account_name, pl.period_start
      ORDER BY am.report_section, am.report_line, a.account_number
    `, [months[0].start, months[11].end, companyFileId]);

    console.log(`   Found ${mappedData.rows.length} data points from mapped accounts\n`);

    // Organize data by section → line → month
    const dataBySection = {};
    
    mappedData.rows.forEach(row => {
      if (!dataBySection[row.report_section]) {
        dataBySection[row.report_section] = {};
      }
      if (!dataBySection[row.report_section][row.report_line]) {
        dataBySection[row.report_section][row.report_line] = {};
        months.forEach(m => {
          dataBySection[row.report_section][row.report_line][m.label] = 0;
        });
      }
      
      if (row.period_start) {
        const monthLabel = new Date(row.period_start).toLocaleDateString('en-US', { month: 'long' });
        if (dataBySection[row.report_section][row.report_line][monthLabel] !== undefined) {
          dataBySection[row.report_section][row.report_line][monthLabel] += parseFloat(row.amount);
        }
      }
    });

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('LTM Summary');

    // Set column widths
    const columnWidths = [{ width: 35 }]; // Row label column
    months.forEach(() => columnWidths.push({ width: 15 })); // Month columns
    columnWidths.push({ width: 15 }); // LTM Total column
    worksheet.columns = columnWidths;

    // Row 1: Company Name (black, bold, CENTER)
    const row1 = worksheet.getRow(1);
    worksheet.mergeCells(1, 1, 1, months.length + 2);
    row1.getCell(1).value = companyName;
    row1.getCell(1).font = { bold: true, color: { argb: 'FF000000' } };
    row1.getCell(1).alignment = { horizontal: 'center' };

    // Row 2: Last Twelve Months (blue, bold)
    const row2 = worksheet.getRow(2);
    worksheet.mergeCells(2, 1, 2, months.length + 2);
    row2.getCell(1).value = `Last Twelve Months - ${reportMonth}`;
    row2.getCell(1).font = { bold: true, color: { argb: 'FF0000FF' } };
    row2.getCell(1).alignment = { horizontal: 'center' };

    // Row 3: Income Statement Summary (black, bold)
    const row3 = worksheet.getRow(3);
    worksheet.mergeCells(3, 1, 3, months.length + 2);
    row3.getCell(1).value = 'Income Statement Summary';
    row3.getCell(1).font = { bold: true, color: { argb: 'FF000000' } };
    row3.getCell(1).alignment = { horizontal: 'center' };

    // Add blank row
    worksheet.addRow([]);

    // Add month headers (blue, bold, with thick black border underneath)
    // LTM Total should be BLACK, not blue
    const headers = ['', ...months.map(m => m.label), 'LTM Total'];
    const headerRow = worksheet.addRow(headers);
    
    // Month columns are blue
    for (let i = 1; i <= months.length + 1; i++) {
      if (i === 1) {
        headerRow.getCell(i).font = { bold: true };
      } else if (i <= months.length + 1) {
        headerRow.getCell(i).font = { bold: true, color: { argb: 'FF0000FF' } };
      }
    }
    
    // LTM Total is BLACK
    headerRow.getCell(months.length + 2).font = { bold: true, color: { argb: 'FF000000' } };
    
    // Add thick bottom border to entire header row
    for (let col = 1; col <= months.length + 2; col++) {
      headerRow.getCell(col).border = {
        bottom: { style: 'thick', color: { argb: 'FF000000' } }
      };
    }

    // Helper function to add data row
    const addRow = (label, monthlyData, isIndented = false, isBold = true, isPercentage = false, fontSize = 11) => {
      const displayLabel = isIndented ? `     ${label}` : label;
      const rowData = [displayLabel];
      
      let ltmTotal = 0;
      months.forEach(month => {
        const value = monthlyData && monthlyData[month.label] !== undefined ? monthlyData[month.label] : null;
        rowData.push(value);
        if (value !== null) ltmTotal += value;
      });
      rowData.push(monthlyData ? ltmTotal : null);
      
      const row = worksheet.addRow(rowData);
      
      if (isBold && !isIndented) {
        row.font = { bold: true, size: fontSize };
      } else {
        row.font = { size: fontSize };
      }
      
      // Format currency/percentage columns (columns 2 onwards)
      const numFmt = isPercentage ? '0.0%' : '$#,##0;[Red]($#,##0)';
      for (let i = 2; i <= months.length + 2; i++) {
        if (rowData[i - 1] !== null) {
          row.getCell(i).numFmt = numFmt;
        }
      }
      
      return row;
    };

    // Helper to add blank row
    const addBlankRow = () => {
      worksheet.addRow([]);
    };

    // Helper to calculate totals across report lines
    const calculateSectionTotal = (section) => {
      const total = {};
      months.forEach(m => { total[m.label] = 0; });
      
      if (dataBySection[section]) {
        Object.values(dataBySection[section]).forEach(lineData => {
          months.forEach(m => {
            total[m.label] += lineData[m.label] || 0;
          });
        });
      }
      return total;
    };

    // ROUNDS & AVERAGE PER ROUND (placeholder - no data yet)
    addRow('ROUNDS', {}, false, true, false);
    addRow('AVERAGE PER ROUND', {}, false, true, false);
    addBlankRow();

    // COURSE REVENUES (header only - no data in this row)
    addRow('COURSE REVENUES', null, false, true);
    if (dataBySection['COURSE_REVENUES']) {
      if (dataBySection['COURSE_REVENUES']['DUES']) {
        addRow('DUES', dataBySection['COURSE_REVENUES']['DUES'], true, false);
      }
      if (dataBySection['COURSE_REVENUES']['INITIATION_FEES']) {
        addRow('INITIATION FEES', dataBySection['COURSE_REVENUES']['INITIATION_FEES'], true, false);
      }
      if (dataBySection['COURSE_REVENUES']['GREENS_FEES']) {
        addRow('GREENS FEES', dataBySection['COURSE_REVENUES']['GREENS_FEES'], true, false);
      }
      if (dataBySection['COURSE_REVENUES']['CART_FEES']) {
        addRow('CART FEES', dataBySection['COURSE_REVENUES']['CART_FEES'], true, false);
      }
      if (dataBySection['COURSE_REVENUES']['RANGE']) {
        addRow('RANGE', dataBySection['COURSE_REVENUES']['RANGE'], true, false);
      }
      if (dataBySection['COURSE_REVENUES']['OTHER_PRO_SHOP_INCOME']) {
        addRow('OTHER PRO SHOP INCOME', dataBySection['COURSE_REVENUES']['OTHER_PRO_SHOP_INCOME'], true, false);
      }
      if (dataBySection['COURSE_REVENUES']['OTHER_MEMBERSHIP_INCOME']) {
        addRow('OTHER MEMBERSHIP INCOME', dataBySection['COURSE_REVENUES']['OTHER_MEMBERSHIP_INCOME'], true, false);
      }
    }
    
    addBlankRow();
    const totalCourseRevenues = calculateSectionTotal('COURSE_REVENUES');
    addRow('TOTAL COURSE REVENUES', totalCourseRevenues, false, true);
    addBlankRow();
    addBlankRow();

    // MERCHANDISE (header only - no data)
    addRow('MERCHANDISE', null, false, true);
    const merchSales = dataBySection['MERCHANDISE']?.['MERCHANDISE_SALES'] || {};
    const merchCOGS = dataBySection['MERCHANDISE']?.['MERCHANDISE_COGS'] || {};
    
    addRow('SALES', merchSales, true, false);
    addRow('COST OF SALES', merchCOGS, true, false);
    
    // COGS %
    const merchCOGSPercent = {};
    months.forEach(m => {
      const sales = merchSales[m.label] || 0;
      merchCOGSPercent[m.label] = sales !== 0 ? (merchCOGS[m.label] || 0) / sales : 0;
    });
    addRow('COGS %', merchCOGSPercent, true, false, true);
    
    // Gross Profit Merchandise
    const merchGrossProfit = {};
    months.forEach(m => {
      merchGrossProfit[m.label] = (merchSales[m.label] || 0) - (merchCOGS[m.label] || 0);
    });
    addRow('GROSS PROFIT MERCHANDISE', merchGrossProfit, false, true);
    addBlankRow();

    // FOOD & BEVERAGE (header only - no data)
    addRow('FOOD & BEVERAGE', null, false, true);
    const fbSales = dataBySection['FOOD_BEVERAGE']?.['FB_SALES'] || {};
    const fbCOGS = dataBySection['FOOD_BEVERAGE']?.['FB_COGS'] || {};
    
    addRow('SALES', fbSales, true, false);
    addRow('COST OF SALES', fbCOGS, true, false);
    
    // COGS %
    const fbCOGSPercent = {};
    months.forEach(m => {
      const sales = fbSales[m.label] || 0;
      fbCOGSPercent[m.label] = sales !== 0 ? (fbCOGS[m.label] || 0) / sales : 0;
    });
    addRow('COGS %', fbCOGSPercent, true, false, true);
    addRow('OTHER F&B INCOME', {}, true, false);
    
    const fbGrossProfit = {};
    months.forEach(m => {
      fbGrossProfit[m.label] = (fbSales[m.label] || 0) - (fbCOGS[m.label] || 0);
    });
    addRow('GROSS PROFIT FOOD & BEVERAGE', fbGrossProfit, false, true);
    addBlankRow();

    // LABOR (header only - no data)
    addRow('LABOR', null, false, true);
    if (dataBySection['LABOR']) {
      Object.entries({
        'GOLF_OPS_LABOR': 'GOLF OPERATIONS LABOR',
        'FB_LABOR': 'F&B LABOR',
        'MAINTENANCE_LABOR': 'MAINTENANCE LABOR',
        'POOL_LABOR': 'POOL LABOR',
        'TENNIS_LABOR': 'TENNIS LABOR',
        'BUILDING_MAINT_LABOR': 'BUILDING MAINTENANCE LABOR',
        'MARKETING_LABOR': 'MARKETING LABOR',
        'ADMIN_LABOR': 'ADMINISTRATIVE LABOR'
      }).forEach(([key, label]) => {
        if (dataBySection['LABOR'][key]) {
          addRow(label, dataBySection['LABOR'][key], true, false);
        }
      });
    }
    const totalLabor = calculateSectionTotal('LABOR');
    addRow('TOTAL LABOR', totalLabor, false, true);
    addBlankRow();

    // EXPENSES (header only - no data)
    addRow('EXPENSES', null, false, true);
    if (dataBySection['EXPENSES']) {
      Object.entries({
        'PRO_SHOP_EXPENSE': 'PRO SHOP EXPENSE',
        'HOTEL_EXPENSE': 'HOTEL / VILLA EXPENSE',
        'OTHER_FB_EXPENSE': 'OTHER F&B EXPENSE',
        'MAINTENANCE_EXPENSE': 'COURSE MAINTENANCE EXPENSE',
        'POOL_EXPENSE': 'POOL EXPENSE',
        'TENNIS_EXPENSE': 'TENNIS EXPENSE',
        'BUILDING_MAINT_EXPENSE': 'BUILDING MAINTENANCE',
        'MARKETING_EXPENSE': 'MARKETING EXPENSE',
        'ADMIN_EXPENSE': 'ADMINISTRATIVE EXPENSE'
      }).forEach(([key, label]) => {
        if (dataBySection['EXPENSES'][key]) {
          addRow(label, dataBySection['EXPENSES'][key], true, false);
        }
      });
    }
    const totalExpenses = calculateSectionTotal('EXPENSES');
    addRow('TOTAL DEPARTMENTAL EXPENSES', totalExpenses, false, true);
    addBlankRow();

    // TOTALS
    const totalGrossRevenues = {};
    const courseOpIncome = {};
    months.forEach(m => {
      totalGrossRevenues[m.label] = (totalCourseRevenues[m.label] || 0) + 
                                     (merchGrossProfit[m.label] || 0) + 
                                     (fbGrossProfit[m.label] || 0);
      courseOpIncome[m.label] = totalGrossRevenues[m.label] - 
                                 (totalLabor[m.label] || 0) - 
                                 (totalExpenses[m.label] || 0);
    });
    
    addRow('TOTAL GROSS REVENUES', totalGrossRevenues, false, true);
    addRow('TOTAL EXPENSES', totalExpenses, false, true);
    addBlankRow();
    
    // COURSE OPERATING INCOME with thin line
    const coiRow = addRow('COURSE OPERATING INCOME', courseOpIncome, false, true);
    // Add thin continuous line from column B (2) through column N (months.length + 2)
    for (let col = 2; col <= months.length + 2; col++) {
      coiRow.getCell(col).border = {
        top: { style: 'thin', color: { argb: 'FF000000' } }
      };
    }
    
    // Add % row below Course Operating Income (smaller font)
    const percentRow = {};
    months.forEach(m => {
      const grossRev = totalGrossRevenues[m.label] || 0;
      percentRow[m.label] = grossRev !== 0 ? (courseOpIncome[m.label] || 0) / grossRev : 0;
    });
    addRow('', percentRow, false, false, true, 9); // Smaller font size
    
    addBlankRow();
    addBlankRow();

    // NEW EXTRAORDINARY SECTION
    addRow('EXTRAORDINARY EXPENSES', {}, false, true);
    addRow('GAIN / (LOSS) ON SALE OF ASSETS', {}, false, true);
    addRow('CAPEX/MINORITY INTEREST', {}, false, true);
    addRow('CART LEASE', dataBySection['EXTRAORDINARY']?.['CART_LEASE'] || {}, false, true);
    addRow('MANAGEMENT FEE', {}, false, true);
    addRow('OTHER INCOME', {}, false, true);
    addRow('INTEREST INCOME', dataBySection['EXTRAORDINARY']?.['INTEREST_INCOME'] || {}, false, true);
    addRow('REAL ESTATE PROPERTY LEASE', {}, false, true);
    
    addBlankRow();
    
    // EBITDA (bolded) - formula placeholder for now
    const ebitda = {};
    months.forEach(m => {
      ebitda[m.label] = courseOpIncome[m.label] || 0; // Simplified for now
    });
    addRow('EBITDA', ebitda, false, true);
    
    addRow('INTEREST', dataBySection['EXTRAORDINARY']?.['INTEREST'] || {}, false, true);
    addRow('INTEREST-AUTO & CAPITAL LEASES', dataBySection['EXTRAORDINARY']?.['INTEREST_AUTO_CAP_LEASE'] || {}, false, true);
    addRow('INTEREST LOAN FEE AMORTIZATION', {}, false, true);
    
    addBlankRow();
    
    // EBTDA (bolded)
    const ebtda = {};
    months.forEach(m => {
      ebtda[m.label] = ebitda[m.label] || 0; // Simplified for now
    });
    addRow('EBTDA', ebtda, false, true);
    
    addRow('DEPRECIATION', dataBySection['EXTRAORDINARY']?.['DEPRECIATION'] || {}, false, true);
    addRow('AMORTIZATION', dataBySection['EXTRAORDINARY']?.['AMORTIZATION'] || {}, false, true);
    addRow('INCOME TAX EXPENSE', {}, false, true);
    
    addBlankRow();
    
    // NET PROFIT (LOSS)
    const netProfit = {};
    months.forEach(m => {
      netProfit[m.label] = ebtda[m.label] || 0; // Simplified for now
    });
    addRow('NET PROFIT (LOSS)', netProfit, false, true);

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

    return filepath;

  } catch (error) {
    console.error('❌ Error generating LTM summary:', error);
    throw error;
  }
}

module.exports = { generateLTMSummary };