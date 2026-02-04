const fs = require('fs').promises;
const csv = require('csv-parser');
const { createReadStream } = require('fs');
const db = require('./connection');
const path = require('path');

async function importChartOfAccounts() {
  console.log('📊 Importing Chart of Accounts...\n');
  
  const accounts = [];
  const csvPath = path.join(__dirname, '../../data/greatlife/chart-of-accounts.csv');
  
  // Read CSV file
  return new Promise((resolve, reject) => {
    createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row) => {
        // Use column indexes to avoid name matching issues
        const columns = Object.values(row);
        const accountName = columns[0];
        const accountType = columns[1];
        const accountNumber = columns[2];
        const parentAccount = columns[3];
        
        // Skip rows missing critical data
        if (!accountNumber || !accountNumber.trim || accountNumber.trim() === '' ||
            !accountName || !accountName.trim || accountName.trim() === '' ||
            !accountType || !accountType.trim || accountType.trim() === '') {
          return;
        }
        
        accounts.push({
          account_name: accountName.trim(),
          account_type: accountType.trim(),
          account_number: accountNumber.trim(),
          parent_account: parentAccount && parentAccount.trim ? parentAccount.trim() : null,
          department_code: extractDepartmentCode(accountNumber.trim())
        });
      })
      .on('end', async () => {
        console.log(`✅ Parsed ${accounts.length} accounts from CSV\n`);
        
        try {
          // Get test company to link accounts to
          const companies = await db.getAllCompanyFiles();
          
          if (companies.length === 0) {
            console.log('⚠️  No company files found. Creating test company...');
            const testCompany = await db.insertCompanyFile({
              company_name: 'GreatLIFE Standard COA',
              file_type: 'COA_Template',
              qb_version: '15.0',
              location: 'Corporate',
              qb_type: 'Standard'
            });
            companies.push(testCompany);
          }
          
          const companyId = companies[0].id;
          console.log(`📝 Linking accounts to company: ${companies[0].company_name} (ID: ${companyId})\n`);
          
          // Insert accounts
          let inserted = 0;
          let skipped = 0;
          
          for (const account of accounts) {
            try {
              await db.query(`
                INSERT INTO accounts (
                  company_file_id,
                  account_list_id,
                  account_name,
                  account_type,
                  account_number,
                  department_code,
                  description
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (company_file_id, account_list_id) DO NOTHING
              `, [
                companyId,
                account.account_number,
                account.account_name,
                account.account_type,
                account.account_number,
                account.department_code,
                account.parent_account ? `Parent: ${account.parent_account}` : null
              ]);
              
              inserted++;
              
              if (inserted % 50 === 0) {
                console.log(`   Inserted ${inserted} accounts...`);
              }
            } catch (error) {
              if (error.code !== '23505') {
                console.error(`   ⚠️  Error inserting ${account.account_name}:`, error.message);
              }
              skipped++;
            }
          }
          
          console.log(`\n✅ Import complete!`);
          console.log(`   Inserted: ${inserted} accounts`);
          console.log(`   Skipped: ${skipped} accounts`);
          
          // Verify
          const accountCount = await db.query('SELECT COUNT(*) FROM accounts WHERE company_file_id = $1', [companyId]);
          console.log(`\n📊 Total accounts in database: ${accountCount.rows[0].count}`);
          
          // Show sample
          const sampleAccounts = await db.query(`
            SELECT account_name, account_type, account_number, department_code
            FROM accounts
            WHERE company_file_id = $1
            ORDER BY account_number
            LIMIT 10
          `, [companyId]);
          
          console.log(`\n📋 Sample accounts:`);
          sampleAccounts.rows.forEach(acc => {
            console.log(`   ${acc.account_number} - ${acc.account_name} (${acc.account_type}) [Dept: ${acc.department_code || 'N/A'}]`);
          });
          
          resolve();
          process.exit(0);
          
        } catch (error) {
          console.error('❌ Import failed:', error);
          reject(error);
          process.exit(1);
        }
      })
      .on('error', reject);
  });
}

// Extract department code from account number (e.g., "1-40110" → "1")
function extractDepartmentCode(accountNumber) {
  if (!accountNumber) return null;
  const match = accountNumber.match(/^(\d+)-/);
  return match ? match[1] : null;
}

importChartOfAccounts();