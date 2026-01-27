
console.log('🚀 Starting test...');

const db = require('./connection');

async function testDatabase() {
  try {
    console.log('🧪 Testing database connection...\n');
    
    // Test 1: Basic connection
    const result = await db.query('SELECT NOW()');
    console.log('✅ Test 1: Database connection successful');
    console.log('   Current timestamp:', result.rows[0].now);
    
    // Test 2: Insert company file
    console.log('\n🧪 Test 2: Inserting test company files...');
    const testCompanies = [
      {
        company_name: 'Topeka Golf Course',
        qb_version: '16.0',
        location: 'Midwest',
        file_path: '/qb/midwest/topeka.qbw',
        qb_type: 'Enterprise 2025'
      },
      {
        company_name: 'Harrisburg Golf Course',
        qb_version: '15.0',
        location: 'Pennsylvania',
        file_path: '/qb/pa/harrisburg.qbw',
        qb_type: 'Accountant Desktop Plus 2024'
      }
    ];
    
    for (const company of testCompanies) {
      const inserted = await db.insertCompanyFile(company);
      console.log(`✅ Inserted: ${inserted.company_name} (ID: ${inserted.id})`);
    }
    
    // Test 3: Query all companies
    console.log('\n🧪 Test 3: Querying all company files...');
    const companies = await db.getAllCompanyFiles();
    console.log(`✅ Found ${companies.length} company file(s):`);
    companies.forEach(c => {
      console.log(`   - ${c.company_name} (${c.location}, ${c.qb_type})`);
    });
    
    // Test 4: Insert account
    console.log('\n🧪 Test 4: Inserting test account...');
    const testAccount = {
      company_file_id: companies[0].id,
      account_list_id: 'ACC-001',
      account_name: 'Sales Revenue',
      account_type: 'Income',
      account_number: '4000',
      balance: 150000.00
    };
    const account = await db.insertAccount(testAccount);
    console.log(`✅ Inserted account: ${account.account_name} (ID: ${account.id})`);
    
    // Test 5: Insert P&L data
    console.log('\n🧪 Test 5: Inserting P&L data...');
    const testPL = {
      company_file_id: companies[0].id,
      account_id: account.id,
      report_date: '2026-01-31',
      period_start: '2026-01-01',
      period_end: '2026-01-31',
      amount: 25000.00
    };
    const plData = await db.insertPLData(testPL);
    console.log(`✅ Inserted P&L data for ${plData.report_date}`);
    
    console.log('\n✅ ALL TESTS PASSED!\n');
    console.log('📊 Database is ready for QB data ingestion.');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testDatabase();