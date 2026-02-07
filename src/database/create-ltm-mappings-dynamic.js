const db = require('./connection');

// LTM Summary Mapping - Based on ACTUAL GreatLIFE Chart of Accounts
const LTM_MAPPINGS = {
  
  // COURSE REVENUES (Department 1 Income accounts)
  COURSE_REVENUES: {
    DUES: {
      accounts: ['1-40005', '1-40010', '1-40015', '1-40020', '1-40025', '1-40030', '1-40035'],
      pattern: 'DUES'
    },
    INITIATION_FEES: {
      accounts: ['1-40100'],
      pattern: 'INITIATION'
    },
    GREENS_FEES: {
      accounts: ['1-40110', '1-40115', '1-40120', '1-40125', '1-40130', '1-40135', '1-40140', '1-40145'],
      pattern: 'GREEN'
    },
    CART_FEES: {
      accounts: ['1-40190', '1-40195', '1-40200', '1-40205', '1-40210', '1-40215', '1-40240', '1-41190', '1-41195', '1-41200', '1-41205', '1-41210', '1-41215'],
      pattern: 'CART'
    },
    RANGE: {
      accounts: ['1-40300', '1-40305'],
      pattern: 'RANGE'
    },
    OTHER_PRO_SHOP_INCOME: {
      accounts: ['1-40350', '1-40360', '1-40370', '1-40380', '1-40390', '1-40400'],
      pattern: null // Catch remaining Dept 1 income
    },
    OTHER_MEMBERSHIP_INCOME: {
      accounts: ['1-40500'],
      pattern: 'MEMBERSHIP'
    }
  },
  
  // MERCHANDISE (Department 2)
  MERCHANDISE: {
    MERCHANDISE_SALES: {
      accounts: ['2-40400', '2-40405', '2-40410', '2-40415', '2-40420', '2-40425', '2-40430', '2-40435', '2-40440'],
      pattern: null
    },
    MERCHANDISE_COGS: {
      accounts: ['2-50400', '2-50405', '2-50410', '2-50415', '2-50420', '2-50425', '2-50430', '2-50435', '2-50440'],
      pattern: 'COST OF'
    }
  },
  
  // FOOD & BEVERAGE (Department 3)
  FOOD_BEVERAGE: {
    FB_SALES: {
      accounts: ['3-41500', '3-42500', '3-43500', '3-44500', '3-45500', '3-41505', '3-42505', '3-43505', '3-44505', '3-45505', '3-41510', '3-42510', '3-43510', '3-44510', '3-45510', '3-41515', '3-42515', '3-43515', '3-44515', '3-45515'],
      pattern: null // All Dept 3 income 41xxx-45xxx
    },
    FB_COGS: {
      accounts: ['3-51100', '3-51105', '3-51110', '3-51115'],
      pattern: 'COST OF'
    },
    OTHER_FB_INCOME: {
      accounts: ['3-46000'],
      pattern: 'OTHER'
    }
  },
  
  // LABOR - By Department
  LABOR: {
    GOLF_OPS_LABOR: {
      accountPattern: '1-60', // All Dept 1 labor accounts
      pattern: 'WAGES'
    },
    FB_LABOR: {
      accountPattern: '3-60', // All Dept 3 labor accounts
      pattern: 'WAGES'
    },
    MAINTENANCE_LABOR: {
      accountPattern: '4-60', // All Dept 4 labor accounts
      pattern: 'WAGES'
    },
    POOL_LABOR: {
      accountPattern: '5-60',
      pattern: 'WAGES'
    },
    TENNIS_LABOR: {
      accountPattern: '6-60',
      pattern: 'WAGES'
    },
    BUILDING_MAINT_LABOR: {
      accountPattern: '7-60',
      pattern: 'WAGES'
    },
    MARKETING_LABOR: {
      accountPattern: '8-60',
      pattern: 'WAGES'
    },
    ADMIN_LABOR: {
      accountPattern: '9-60',
      pattern: 'WAGES'
    }
  },
  
  // EXPENSES - By Department
  EXPENSES: {
    PRO_SHOP_EXPENSE: {
      accountPattern: '1-70',
      pattern: null
    },
    HOTEL_EXPENSE: {
      accounts: ['2-70XXX'], // Adjust based on actual accounts
      pattern: 'HOTEL'
    },
    OTHER_FB_EXPENSE: {
      accountPattern: '3-70',
      pattern: null
    },
    MAINTENANCE_EXPENSE: {
      accountPattern: '4-70',
      pattern: null
    },
    POOL_EXPENSE: {
      accountPattern: '5-70',
      pattern: null
    },
    TENNIS_EXPENSE: {
      accountPattern: '6-70',
      pattern: null
    },
    BUILDING_MAINT_EXPENSE: {
      accountPattern: '7-70',
      pattern: null
    },
    MARKETING_EXPENSE: {
      accountPattern: '8-70',
      pattern: null
    },
    ADMIN_EXPENSE: {
      accountPattern: '9-70',
      pattern: null
    }
  },
  
  // EXTRAORDINARY ITEMS (0- prefix, 75xxx range)
  EXTRAORDINARY: {
    INTEREST: {
      accounts: ['0-75040'],
      pattern: 'INTEREST EXPENSE'
    },
    INTEREST_AUTO_CAP_LEASE: {
      accounts: ['0-75060', '0-75080'],
      pattern: 'INTEREST EXPENSE'
    },
    INTEREST_LOAN_FEE: {
      accounts: ['0-75100'],
      pattern: 'LOAN FEE'
    },
    DEPRECIATION: {
      accounts: ['0-75550'],
      pattern: 'DEPRECIATION'
    },
    AMORTIZATION: {
      accounts: ['0-75500'],
      pattern: 'AMORTIZATION'
    },
    INTEREST_INCOME: {
      accounts: ['0-40820'],
      pattern: 'INTEREST INCOME'
    },
    CART_LEASE: {
      accounts: ['0-75000'],
      pattern: 'CART LEASE'
    }
  }
};

async function createDynamicMappings() {
  console.log('📊 Creating Dynamic LTM Account Mappings...\n');
  
  try {
    // Get all accounts from database
    const allAccounts = await db.query(`
      SELECT account_number, account_name, account_type
      FROM accounts
      WHERE company_file_id = (SELECT id FROM company_files LIMIT 1)
      ORDER BY account_number
    `);
    
    const accountsMap = {};
    allAccounts.rows.forEach(acc => {
      accountsMap[acc.account_number] = {
        name: acc.account_name,
        type: acc.account_type
      };
    });
    
    let totalMapped = 0;
    let notFound = 0;
    
    for (const [section, lines] of Object.entries(LTM_MAPPINGS)) {
      console.log(`\n📂 Section: ${section}`);
      
      for (const [line, config] of Object.entries(lines)) {
        let accountsToMap = [];
        
        // If explicit accounts list
        if (config.accounts) {
          accountsToMap = config.accounts;
        }
        // If pattern matching (e.g., all "1-60" accounts)
        else if (config.accountPattern) {
          const pattern = config.accountPattern;
          accountsToMap = allAccounts.rows
            .filter(acc => acc.account_number.startsWith(pattern))
            .map(acc => acc.account_number);
        }
        
        // Map each account
        for (const accountNumber of accountsToMap) {
          if (!accountsMap[accountNumber]) {
            console.log(`   ⚠️  Account ${accountNumber} not found - skipping`);
            notFound++;
            continue;
          }
          
          try {
            await db.query(`
              INSERT INTO account_mappings (
                account_number,
                report_name,
                report_section,
                report_line,
                calculation_type,
                notes
              ) VALUES ($1, $2, $3, $4, $5, $6)
              ON CONFLICT (account_number, report_name, report_line) DO NOTHING
            `, [
              accountNumber,
              'LTM_SUMMARY',
              section,
              line,
              'SUM',
              `${accountsMap[accountNumber].name} (${accountsMap[accountNumber].type})`
            ]);
            
            totalMapped++;
            console.log(`   ✅ ${accountNumber} → ${line}`);
            
          } catch (error) {
            console.error(`   ❌ Error mapping ${accountNumber}:`, error.message);
          }
        }
      }
    }
    
    console.log(`\n✅ Mapping complete!`);
    console.log(`   Total mapped: ${totalMapped}`);
    console.log(`   Not found: ${notFound}`);
    
    // Show summary
    const summary = await db.query(`
      SELECT report_section, report_line, COUNT(*) as account_count
      FROM account_mappings
      WHERE report_name = 'LTM_SUMMARY'
      GROUP BY report_section, report_line
      ORDER BY report_section, report_line
    `);
    
    console.log(`\n📊 Mappings by section:`);
    let currentSection = '';
    summary.rows.forEach(row => {
      if (row.report_section !== currentSection) {
        console.log(`\n${row.report_section}:`);
        currentSection = row.report_section;
      }
      console.log(`   ${row.report_line}: ${row.account_count} accounts`);
    });
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Mapping failed:', error);
    process.exit(1);
  }
}

createDynamicMappings();