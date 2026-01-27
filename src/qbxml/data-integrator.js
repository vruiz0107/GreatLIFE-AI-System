const db = require('../database/connection');
const parser = require('./parser');

// Store P&L data in database
const storePLData = async (companyFileId, plAccounts, reportDate, periodStart, periodEnd) => {
  console.log(`\n💾 Storing P&L data for company ${companyFileId}...`);
  
  const results = {
    accountsCreated: 0,
    plRecordsCreated: 0,
    errors: []
  };
  
  try {
    for (const accountData of plAccounts) {
      try {
        // First, insert/update the account
        const account = await db.insertAccount({
          company_file_id: companyFileId,
          account_list_id: `ACC-${accountData.account_number || Math.random().toString(36).substr(2, 9)}`,
          account_name: accountData.account_name,
          account_type: accountData.account_type,
          account_number: accountData.account_number,
          balance: accountData.amount
        });
        
        results.accountsCreated++;
        
        // Then insert P&L data for this account
        await db.insertPLData({
          company_file_id: companyFileId,
          account_id: account.id,
          report_date: reportDate,
          period_start: periodStart,
          period_end: periodEnd,
          amount: accountData.amount
        });
        
        results.plRecordsCreated++;
        
      } catch (error) {
        results.errors.push({
          account: accountData.account_name,
          error: error.message
        });
      }
    }
    
    console.log(`✅ Stored ${results.accountsCreated} accounts and ${results.plRecordsCreated} P&L records`);
    if (results.errors.length > 0) {
      console.log(`⚠️  ${results.errors.length} errors occurred`);
    }
    
    return results;
  } catch (error) {
    console.error('Error storing P&L data:', error);
    throw error;
  }
};

// Store Balance Sheet data in database
const storeBalanceSheetData = async (companyFileId, bsAccounts, reportDate) => {
  console.log(`\n💾 Storing Balance Sheet data for company ${companyFileId}...`);
  
  const results = {
    accountsCreated: 0,
    bsRecordsCreated: 0,
    errors: []
  };
  
  try {
    for (const accountData of bsAccounts) {
      try {
        // First, insert/update the account
        const account = await db.insertAccount({
          company_file_id: companyFileId,
          account_list_id: `ACC-${accountData.account_number || Math.random().toString(36).substr(2, 9)}`,
          account_name: accountData.account_name,
          account_type: accountData.account_type,
          account_number: accountData.account_number,
          balance: accountData.amount
        });
        
        results.accountsCreated++;
        
        // Then insert Balance Sheet data
        await db.insertBalanceSheetData({
          company_file_id: companyFileId,
          account_id: account.id,
          report_date: reportDate,
          amount: accountData.amount,
          account_category: accountData.account_category
        });
        
        results.bsRecordsCreated++;
        
      } catch (error) {
        results.errors.push({
          account: accountData.account_name,
          error: error.message
        });
      }
    }
    
    console.log(`✅ Stored ${results.accountsCreated} accounts and ${results.bsRecordsCreated} Balance Sheet records`);
    if (results.errors.length > 0) {
      console.log(`⚠️  ${results.errors.length} errors occurred`);
    }
    
    return results;
  } catch (error) {
    console.error('Error storing Balance Sheet data:', error);
    throw error;
  }
};

// Process QBXML file and store in database
const processQBXMLFile = async (xmlFilePath, companyFileId, reportType, reportDate, periodStart, periodEnd) => {
  console.log(`\n🔄 Processing ${reportType} from ${xmlFilePath}...`);
  
  try {
    // Parse the XML file
    const qbxmlData = await parser.parseSampleFile(xmlFilePath);
    
    let results;
    
    if (reportType === 'P&L' || reportType === 'ProfitAndLoss') {
      // Parse P&L specific data
      const plAccounts = parser.parseProfitAndLoss(qbxmlData);
      console.log(`📊 Parsed ${plAccounts.length} P&L accounts`);
      
      // Store in database
      results = await storePLData(companyFileId, plAccounts, reportDate, periodStart, periodEnd);
      
    } else if (reportType === 'BalanceSheet' || reportType === 'BS') {
      // Parse Balance Sheet specific data
      const bsAccounts = parser.parseBalanceSheet(qbxmlData);
      console.log(`📊 Parsed ${bsAccounts.length} Balance Sheet accounts`);
      
      // Store in database
      results = await storeBalanceSheetData(companyFileId, bsAccounts, reportDate);
    } else {
      throw new Error(`Unknown report type: ${reportType}`);
    }
    
    return results;
    
  } catch (error) {
    console.error(`Error processing QBXML file:`, error);
    throw error;
  }
};

module.exports = {
  storePLData,
  storeBalanceSheetData,
  processQBXMLFile
};