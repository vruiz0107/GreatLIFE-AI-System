const db = require('./connection');

// LTM Summary Mapping Configuration
const LTM_MAPPINGS = {
  // COURSE REVENUES
  COURSE_REVENUES: {
    DUES: ['4-30000', '4-30010', '4-30020'], // Example - will update with real account numbers
    INITIATION_FEES: ['4-30100'],
    GREENS_FEES: ['4-30200', '4-30210'],
    CART_FEES: ['4-30300'],
    RANGE: ['4-30400'],
    OTHER_PRO_SHOP_INCOME: ['4-30500'],
    OTHER_MEMBERSHIP_INCOME: ['4-30600']
  },
  
  // MERCHANDISE
  MERCHANDISE: {
    MERCHANDISE_SALES: ['4-40000', '4-40100'],
    MERCHANDISE_COGS: ['5-41000', '5-41100']
  },
  
  // FOOD & BEVERAGE
  FOOD_BEVERAGE: {
    FB_SALES: ['4-50000', '4-50100'],
    FB_COGS: ['5-51000', '5-51100'],
    OTHER_FB_INCOME: ['4-50200']
  },
  
  // LABOR
  LABOR: {
    GOLF_OPS_LABOR: ['5-60000', '5-60100', '5-60200'],
    FB_LABOR: ['5-60300', '5-60400'],
    MAINTENANCE_LABOR: ['5-60500', '5-60600'],
    POOL_LABOR: ['5-60700'],
    TENNIS_LABOR: ['5-60800'],
    BUILDING_MAINT_LABOR: ['5-60900'],
    MARKETING_LABOR: ['5-61000'],
    ADMIN_LABOR: ['5-61100', '5-61200']
  },
  
  // EXPENSES
  EXPENSES: {
    PRO_SHOP_EXPENSE: ['5-70000', '5-70100'],
    HOTEL_EXPENSE: ['5-70200'],
    OTHER_FB_EXPENSE: ['5-70300'],
    MAINTENANCE_EXPENSE: ['5-70400', '5-70500'],
    POOL_EXPENSE: ['5-70600'],
    TENNIS_EXPENSE: ['5-70700'],
    BUILDING_MAINT_EXPENSE: ['5-70800'],
    MARKETING_EXPENSE: ['5-70900'],
    ADMIN_EXPENSE: ['5-71000', '5-71100']
  },
  
  // EXTRAORDINARY ITEMS
  EXTRAORDINARY: {
    EXTRAORDINARY_EXPENSE: ['6-80000'],
    GAIN_LOSS_ASSETS: ['7-90000'],
    CAPEX_MINORITY: ['6-80100'],
    CART_LEASE: ['6-80200'],
    MANAGEMENT_FEE: ['6-80300'],
    OTHER_INCOME: ['7-90100'],
    INTEREST_INCOME: ['7-90200'],
    REAL_ESTATE_LEASE: ['7-90300'],
    INTEREST: ['6-80400'],
    INTEREST_AUTO_CAP_LEASE: ['6-80500'],
    INTEREST_LOAN_FEE: ['6-80600'],
    DEPRECIATION: ['6-80700'],
    AMORTIZATION: ['6-80800'],
    INCOME_TAX: ['6-80900']
  }
};

async function createLTMMappings() {
  console.log('📊 Creating LTM Summary Account Mappings...\n');
  
  try {
    let totalMapped = 0;
    let skipped = 0;
    
    for (const [section, lines] of Object.entries(LTM_MAPPINGS)) {
      console.log(`\n📂 Section: ${section}`);
      
      for (const [line, accounts] of Object.entries(lines)) {
        for (const accountNumber of accounts) {
          try {
            // Check if account exists
            const accountCheck = await db.query(
              'SELECT id FROM accounts WHERE account_number = $1',
              [accountNumber]
            );
            
            if (accountCheck.rows.length === 0) {
              console.log(`   ⚠️  Account ${accountNumber} not found in chart of accounts - skipping`);
              skipped++;
              continue;
            }
            
            // Insert mapping
            await db.query(`
              INSERT INTO account_mappings (
                account_number,
                report_name,
                report_section,
                report_line,
                calculation_type
              ) VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (account_number, report_name, report_line) DO NOTHING
            `, [accountNumber, 'LTM_SUMMARY', section, line, 'SUM']);
            
            totalMapped++;
            console.log(`   ✅ Mapped ${accountNumber} → ${line}`);
            
          } catch (error) {
            console.error(`   ❌ Error mapping ${accountNumber}:`, error.message);
            skipped++;
          }
        }
      }
    }
    
    console.log(`\n✅ Mapping complete!`);
    console.log(`   Total mapped: ${totalMapped}`);
    console.log(`   Skipped: ${skipped}`);
    
    // Show summary
    const summary = await db.query(`
      SELECT report_section, COUNT(*) as account_count
      FROM account_mappings
      WHERE report_name = 'LTM_SUMMARY'
      GROUP BY report_section
      ORDER BY report_section
    `);
    
    console.log(`\n📊 Mappings by section:`);
    summary.rows.forEach(row => {
      console.log(`   ${row.report_section}: ${row.account_count} accounts`);
    });
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Mapping failed:', error);
    process.exit(1);
  }
}

createLTMMappings();