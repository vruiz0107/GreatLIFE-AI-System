require('dotenv').config();

module.exports = {
  // Server configuration
  server: {
    port: process.env.QBWC_PORT || 8080,
    host: process.env.QBWC_HOST || 'localhost',
  },
  
  // QBWC authentication
  qbwc: {
    username: process.env.QBWC_USERNAME || 'greatlife_admin',
    password: process.env.QBWC_PASSWORD || 'change_this_password',
    companyFile: process.env.QB_COMPANY_FILE || '',
  },
  
  // QuickBooks configuration
  quickbooks: {
    minQBVersion: '15.0', // Support both QB 2024 and 2025
    maxQBVersion: '16.0',
  },
  
  // Application settings
  app: {
    appName: 'GreatLIFE AI Automation System',
    appDescription: 'Automated QuickBooks reporting and data extraction',
    appSupport: 'https://yourcompany.com/support',
  },
  
  // Database
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    name: process.env.DB_NAME || 'greatlife_qb_data',
  }
};