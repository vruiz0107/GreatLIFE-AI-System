const { generateBalanceSheet } = require('./balance-sheet-generator');
const db = require('../database/connection');

async function testBalanceSheet() {
  console.log('🧪 Testing Balance Sheet Generator\n');

  try {
    // Get first company
    const companies = await db.getAllCompanyFiles();
    
    if (companies.length === 0) {
      console.error('❌ No companies found in database');
      process.exit(1);
    }

    const companyId = companies[0].id;
    console.log(`Using company: ${companies[0].company_name} (ID: ${companyId})\n`);

    // Generate balance sheet with mock dates
    const reportDate = '2026-01-31';
    const previousYearDate = '2025-01-31';

    const filepath = await generateBalanceSheet(companyId, reportDate, previousYearDate);

    console.log(`\n✅ Test complete! Open the file: ${filepath}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testBalanceSheet();