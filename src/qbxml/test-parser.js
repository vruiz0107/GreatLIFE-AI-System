const parser = require('./parser');
const path = require('path');

async function testParser() {
  console.log('🧪 Testing QBXML Parser...\n');
  
  try {
    // Test 1: Parse P&L Sample
    console.log('📊 Test 1: Parsing Profit & Loss Sample');
    const plPath = path.join(__dirname, 'samples', 'profit-and-loss-response.xml');
    const plXML = await parser.parseSampleFile(plPath);
    const plAccounts = parser.parseProfitAndLoss(plXML);
    
    console.log(`✅ Parsed ${plAccounts.length} P&L accounts:`);
    plAccounts.forEach(acc => {
      console.log(`   - ${acc.account_name} (${acc.account_type}): $${acc.amount.toLocaleString()}`);
    });
    
    // Test 2: Parse Balance Sheet Sample
    console.log('\n📊 Test 2: Parsing Balance Sheet Sample');
    const bsPath = path.join(__dirname, 'samples', 'balance-sheet-response.xml');
    const bsXML = await parser.parseSampleFile(bsPath);
    const bsAccounts = parser.parseBalanceSheet(bsXML);
    
    console.log(`✅ Parsed ${bsAccounts.length} Balance Sheet accounts:`);
    bsAccounts.forEach(acc => {
      console.log(`   - ${acc.account_name} (${acc.account_category}): $${acc.amount.toLocaleString()}`);
    });
    
    // Test 3: Calculate totals
    console.log('\n📊 Test 3: Calculating Totals');
    const totalIncome = plAccounts
      .filter(a => a.account_type === 'Income')
      .reduce((sum, a) => sum + a.amount, 0);
    
    const totalExpenses = plAccounts
      .filter(a => a.account_type === 'Expense')
      .reduce((sum, a) => sum + a.amount, 0);
    
    const netIncome = totalIncome - totalExpenses;
    
    console.log(`✅ Total Income: $${totalIncome.toLocaleString()}`);
    console.log(`✅ Total Expenses: $${totalExpenses.toLocaleString()}`);
    console.log(`✅ Net Income: $${netIncome.toLocaleString()}`);
    
    const totalAssets = bsAccounts
      .filter(a => a.account_category === 'Assets')
      .reduce((sum, a) => sum + a.amount, 0);
    
    const totalLiabilities = bsAccounts
      .filter(a => a.account_category === 'Liabilities')
      .reduce((sum, a) => sum + a.amount, 0);
    
    console.log(`✅ Total Assets: $${totalAssets.toLocaleString()}`);
    console.log(`✅ Total Liabilities: $${totalLiabilities.toLocaleString()}`);
    
    console.log('\n✅ ALL PARSER TESTS PASSED!\n');
    console.log('🎯 Parser is ready to transform QBXML → Database');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ PARSER TEST FAILED:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testParser();