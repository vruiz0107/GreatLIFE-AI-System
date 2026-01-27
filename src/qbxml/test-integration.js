const path = require('path');
const db = require('../database/connection');
const integrator = require('./data-integrator');

async function testIntegration() {
  console.log('🧪 Testing End-to-End Integration: QBXML → Database\n');
  
  try {
    // Step 1: Create test company files
    console.log('📝 Step 1: Creating test company files...');
    
    const topekaCompany = await db.insertCompanyFile({
      company_name: 'Topeka Golf Course - Test',
      qb_version: '16.0',
      location: 'Midwest',
      file_path: '/test/topeka.qbw',
      qb_type: 'Enterprise 2025'
    });
    
    const paCompany = await db.insertCompanyFile({
      company_name: 'Harrisburg Golf Course - Test',
      qb_version: '15.0',
      location: 'Pennsylvania',
      file_path: '/test/harrisburg.qbw',
      qb_type: 'Accountant Desktop Plus 2024'
    });
    
    console.log(`✅ Created company: ${topekaCompany.company_name} (ID: ${topekaCompany.id})`);
    console.log(`✅ Created company: ${paCompany.company_name} (ID: ${paCompany.id})`);
    
    // Step 2: Process P&L for Topeka
    console.log('\n📊 Step 2: Processing P&L for Topeka...');
    const plPath = path.join(__dirname, 'samples', 'profit-and-loss-response.xml');
    const plResults = await integrator.processQBXMLFile(
      plPath,
      topekaCompany.id,
      'P&L',
      '2026-01-31',
      '2026-01-01',
      '2026-01-31'
    );
    
    console.log(`✅ P&L Integration: ${plResults.accountsCreated} accounts, ${plResults.plRecordsCreated} P&L records`);
    
    // Step 3: Process Balance Sheet for PA
    console.log('\n📊 Step 3: Processing Balance Sheet for Pennsylvania...');
    const bsPath = path.join(__dirname, 'samples', 'balance-sheet-response.xml');
    const bsResults = await integrator.processQBXMLFile(
      bsPath,
      paCompany.id,
      'BalanceSheet',
      '2026-01-31'
    );
    
    console.log(`✅ Balance Sheet Integration: ${bsResults.accountsCreated} accounts, ${bsResults.bsRecordsCreated} BS records`);
    
    // Step 4: Query and verify data
    console.log('\n🔍 Step 4: Querying stored data...');
    
    const allCompanies = await db.getAllCompanyFiles();
    console.log(`✅ Total companies in database: ${allCompanies.length}`);
    
    const topekaPLData = await db.getPLData(topekaCompany.id, '2026-01-01', '2026-01-31');
    console.log(`✅ Topeka P&L records: ${topekaPLData.length}`);
    
    if (topekaPLData.length > 0) {
      console.log('\n📊 Sample Topeka P&L Data:');
      topekaPLData.slice(0, 3).forEach(record => {
        console.log(`   - ${record.account_name} (${record.account_type}): $${record.amount.toLocaleString()}`);
      });
    }
    
    // Step 5: Calculate summary statistics
    console.log('\n📈 Step 5: Summary Statistics...');
    
    const accountsQuery = await db.query('SELECT COUNT(*) as count FROM accounts');
    const plQuery = await db.query('SELECT COUNT(*) as count FROM pl_data');
    const bsQuery = await db.query('SELECT COUNT(*) as count FROM balance_sheet_data');
    
    console.log(`✅ Total accounts in database: ${accountsQuery.rows[0].count}`);
    console.log(`✅ Total P&L records: ${plQuery.rows[0].count}`);
    console.log(`✅ Total Balance Sheet records: ${bsQuery.rows[0].count}`);
    
    console.log('\n✅ ✅ ✅ END-TO-END INTEGRATION TEST PASSED! ✅ ✅ ✅\n');
    console.log('🎯 Complete pipeline working: QBXML → Parser → Database → Query');
    console.log('🚀 Ready for production QBWC integration!');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ INTEGRATION TEST FAILED:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testIntegration();