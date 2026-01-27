const fs = require('fs').promises;
const xml2js = require('xml2js');

// Parse XML string to JavaScript object
const parseXML = async (xmlString) => {
  const parser = new xml2js.Parser({
    explicitArray: false,
    mergeAttrs: true,
    trim: true
  });
  
  try {
    const result = await parser.parseStringPromise(xmlString);
    return result;
  } catch (error) {
    console.error('XML parsing error:', error);
    throw error;
  }
};

// Parse P&L Report QBXML
const parseProfitAndLoss = (qbxmlData) => {
  try {
    const reportData = qbxmlData.QBXML.QBXMLMsgsRs.GeneralSummaryReportQueryRs.ReportRet.ReportData;
    const rows = Array.isArray(reportData.DataRow) ? reportData.DataRow : [reportData.DataRow];
    
    const accounts = [];
    
    rows.forEach(row => {
      if (row.RowType === 'Account' && row.RowData) {
        const rowDataValue = row.RowData.value || row.RowData;
        const parts = rowDataValue.split(':');
        
        const account = {
          account_name: row.ColData[0].value,
          amount: parseFloat(row.ColData[1].value) || 0,
          account_number: parts[1] || null,
          account_type: parts[2] || 'Unknown'
        };
        
        accounts.push(account);
      }
    });
    
    return accounts;
  } catch (error) {
    console.error('Error parsing P&L:', error);
    throw error;
  }
};

// Parse Balance Sheet QBXML
const parseBalanceSheet = (qbxmlData) => {
  try {
    const reportData = qbxmlData.QBXML.QBXMLMsgsRs.GeneralSummaryReportQueryRs.ReportRet.ReportData;
    const rows = Array.isArray(reportData.DataRow) ? reportData.DataRow : [reportData.DataRow];
    
    const accounts = [];
    
    rows.forEach(row => {
      if (row.RowType === 'Account' && row.RowData) {
        const rowDataValue = row.RowData.value || row.RowData;
        const parts = rowDataValue.split(':');
        
        const account = {
          account_name: row.ColData[0].value,
          amount: parseFloat(row.ColData[1].value) || 0,
          account_number: parts[1] || null,
          account_type: parts[2] || 'Unknown',
          account_category: determineCategory(row.ColData[0].value)
        };
        
        accounts.push(account);
      }
    });
    
    return accounts;
  } catch (error) {
    console.error('Error parsing Balance Sheet:', error);
    throw error;
  }
};

// Helper to determine account category
const determineCategory = (accountName) => {
  const name = accountName.toLowerCase();
  if (name.includes('asset')) return 'Assets';
  if (name.includes('liability') || name.includes('payable') || name.includes('debt')) return 'Liabilities';
  if (name.includes('equity') || name.includes('capital')) return 'Equity';
  return 'Other';
};

// Read and parse sample file
const parseSampleFile = async (filename) => {
  try {
    const xmlString = await fs.readFile(filename, 'utf-8');
    const parsedXML = await parseXML(xmlString);
    return parsedXML;
  } catch (error) {
    console.error(`Error reading file ${filename}:`, error);
    throw error;
  }
};

module.exports = {
  parseXML,
  parseProfitAndLoss,
  parseBalanceSheet,
  parseSampleFile
};