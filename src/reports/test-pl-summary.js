const { generatePLSummary } = require('./pl-summary-generator');
const db = require('../database/connection');

async function testPLSummary() {
  console.log('🧪 Testing P&L Summary Generator\n');

  try {
    // Get first company
    const companies = await db.getAllCompanyFiles();
    
    if (companies.length === 0) {
      console.error('❌ No companies found in database');
      process.exit(1);
    }

    const companyId = companies[0].id;
    console.log(`Using company: ${companies[0].company_name} (ID: ${companyId})\n`);

    // Generate P&L with mock dates
    const periodStart = '2026-01-01';
    const periodEnd = '2026-01-31';
    const previousYearStart = '2025-01-01';
    const previousYearEnd = '2025-01-31';

    const filepath = await generatePLSummary(
      companyId,
      periodStart,
      periodEnd,
      previousYearStart,
      previousYearEnd
    );

    console.log(`\n✅ Test complete! Open the file: ${filepath}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testPLSummary();