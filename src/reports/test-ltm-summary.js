const { generateLTMSummary } = require('./ltm-summary-generator');
const db = require('../database/connection');

async function testLTMSummary() {
  console.log('🧪 Testing LTM Summary Generator\n');

  try {
    const companies = await db.getAllCompanyFiles();
    
    if (companies.length === 0) {
      console.error('❌ No companies found in database');
      process.exit(1);
    }

    const companyId = companies[0].id;
    console.log(`Using company: ${companies[0].company_name} (ID: ${companyId})\n`);

    // Generate LTM ending January 2026 (goes back to Feb 2025)
    const endDate = '2026-01-31';

    const filepath = await generateLTMSummary(companyId, endDate);

    console.log(`\n✅ Test complete! Open the file: ${filepath}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testLTMSummary();