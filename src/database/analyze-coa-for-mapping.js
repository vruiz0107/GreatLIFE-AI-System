const db = require('./connection');

async function analyzeCOA() {
  console.log('🔍 Analyzing Chart of Accounts for Mapping Suggestions...\n');
  
  try {
    // Get all accounts
    const accounts = await db.query(`
      SELECT account_number, account_name, account_type, description
      FROM accounts
      WHERE company_file_id = (SELECT id FROM company_files LIMIT 1)
      ORDER BY account_number
    `);
    
    console.log(`Total accounts: ${accounts.rows.length}\n`);
    
    // Group by keywords for mapping suggestions
    const suggestions = {
      'DUES': [],
      'GREENS_FEES': [],
      'CART': [],
      'MERCHANDISE': [],
      'FOOD': [],
      'BEVERAGE': [],
      'LABOR': [],
      'PAYROLL': [],
      'SALARY': [],
      'WAGE': [],
      'MAINTENANCE': [],
      'MARKETING': [],
      'ADMIN': [],
      'DEPRECIATION': [],
      'INTEREST': [],
      'AMORTIZATION': []
    };
    
    accounts.rows.forEach(account => {
      const searchText = `${account.account_name} ${account.description || ''}`.toUpperCase();
      
      for (const [keyword, list] of Object.entries(suggestions)) {
        if (searchText.includes(keyword)) {
          list.push({
            number: account.account_number,
            name: account.account_name,
            type: account.account_type
          });
        }
      }
    });
    
    // Print suggestions
    console.log('📋 SUGGESTED MAPPINGS (Review and adjust):\n');
    
    for (const [keyword, matches] of Object.entries(suggestions)) {
      if (matches.length > 0) {
        console.log(`\n${keyword}:`);
        matches.forEach(acc => {
          console.log(`   ${acc.number} - ${acc.name} (${acc.type})`);
        });
      }
    }
    
    // Export to CSV for manual review
    const fs = require('fs');
    const outputPath = 'data/greatlife/suggested-mappings.csv';
    
    let csv = 'Account Number,Account Name,Account Type,Suggested Report Line,Report Section\n';
    
    for (const [keyword, matches] of Object.entries(suggestions)) {
      matches.forEach(acc => {
        // Guess the section based on account type
        let section = 'UNKNOWN';
        if (acc.type === 'Income') section = 'COURSE_REVENUES';
        if (acc.type === 'Cost of Goods Sold') section = 'MERCHANDISE';
        if (acc.type === 'Expense') section = 'EXPENSES';
        
        csv += `"${acc.number}","${acc.name}","${acc.type}","${keyword}","${section}"\n`;
      });
    }
    
    fs.writeFileSync(outputPath, csv);
    console.log(`\n✅ Suggested mappings exported to: ${outputPath}`);
    console.log(`\nNext steps:`);
    console.log(`1. Review the CSV file`);
    console.log(`2. Adjust report lines and sections as needed`);
    console.log(`3. Update LTM_MAPPINGS in src/database/create-mappings.js`);
    console.log(`4. Run: node src/database/create-mappings.js`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
}

analyzeCOA();