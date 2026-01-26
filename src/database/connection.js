const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'greatlife_qb_data',
  user: process.env.DB_USER || process.env.USER,
  password: process.env.DB_PASSWORD || '',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection
pool.on('connect', () => {
  console.log('✅ PostgreSQL connected');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL connection error:', err);
  process.exit(-1);
});

// Helper function to execute queries
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { duration: `${duration}ms`, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  }
};

// Insert company file
const insertCompanyFile = async (companyData) => {
  const { company_name, qb_version, location, file_path, qb_type } = companyData;
  const text = `
    INSERT INTO company_files (company_name, qb_version, location, file_path, qb_type)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT DO NOTHING
    RETURNING *;
  `;
  const values = [company_name, qb_version, location, file_path, qb_type];
  const res = await query(text, values);
  return res.rows[0];
};

// Insert account
const insertAccount = async (accountData) => {
  const { company_file_id, account_list_id, account_name, account_type, account_number, balance } = accountData;
  const text = `
    INSERT INTO accounts (company_file_id, account_list_id, account_name, account_type, account_number, balance)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (company_file_id, account_list_id)
    DO UPDATE SET 
      account_name = EXCLUDED.account_name,
      account_type = EXCLUDED.account_type,
      balance = EXCLUDED.balance,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *;
  `;
  const values = [company_file_id, account_list_id, account_name, account_type, account_number, balance];
  const res = await query(text, values);
  return res.rows[0];
};

// Insert P&L data
const insertPLData = async (plData) => {
  const { company_file_id, account_id, report_date, period_start, period_end, amount } = plData;
  const text = `
    INSERT INTO pl_data (company_file_id, account_id, report_date, period_start, period_end, amount)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (company_file_id, account_id, report_date, period_start, period_end)
    DO UPDATE SET amount = EXCLUDED.amount, created_at = CURRENT_TIMESTAMP
    RETURNING *;
  `;
  const values = [company_file_id, account_id, report_date, period_start, period_end, amount];
  const res = await query(text, values);
  return res.rows[0];
};

// Insert Balance Sheet data
const insertBalanceSheetData = async (bsData) => {
  const { company_file_id, account_id, report_date, amount, account_category } = bsData;
  const text = `
    INSERT INTO balance_sheet_data (company_file_id, account_id, report_date, amount, account_category)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (company_file_id, account_id, report_date)
    DO UPDATE SET amount = EXCLUDED.amount, created_at = CURRENT_TIMESTAMP
    RETURNING *;
  `;
  const values = [company_file_id, account_id, report_date, amount, account_category];
  const res = await query(text, values);
  return res.rows[0];
};

// Insert AR Aging data
const insertARAging = async (arData) => {
  const { company_file_id, customer_name, report_date, current_amount, days_1_30, days_31_60, days_61_90, days_over_90, total_amount } = arData;
  const text = `
    INSERT INTO ar_aging_data (company_file_id, customer_name, report_date, current_amount, days_1_30, days_31_60, days_61_90, days_over_90, total_amount)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (company_file_id, customer_name, report_date)
    DO UPDATE SET 
      current_amount = EXCLUDED.current_amount,
      days_1_30 = EXCLUDED.days_1_30,
      days_31_60 = EXCLUDED.days_31_60,
      days_61_90 = EXCLUDED.days_61_90,
      days_over_90 = EXCLUDED.days_over_90,
      total_amount = EXCLUDED.total_amount,
      created_at = CURRENT_TIMESTAMP
    RETURNING *;
  `;
  const values = [company_file_id, customer_name, report_date, current_amount, days_1_30, days_31_60, days_61_90, days_over_90, total_amount];
  const res = await query(text, values);
  return res.rows[0];
};

// Get all company files
const getAllCompanyFiles = async () => {
  const res = await query('SELECT * FROM company_files WHERE is_active = true ORDER BY location, company_name');
  return res.rows;
};

// Get P&L data for date range
const getPLData = async (companyFileId, startDate, endDate) => {
  const text = `
    SELECT pl.*, a.account_name, a.account_type, cf.company_name, cf.location
    FROM pl_data pl
    JOIN accounts a ON pl.account_id = a.id
    JOIN company_files cf ON pl.company_file_id = cf.id
    WHERE pl.company_file_id = $1
    AND pl.report_date BETWEEN $2 AND $3
    ORDER BY a.account_type, a.account_name;
  `;
  const res = await query(text, [companyFileId, startDate, endDate]);
  return res.rows;
};

module.exports = {
  query,
  pool,
  insertCompanyFile,
  insertAccount,
  insertPLData,
  insertBalanceSheetData,
  insertARAging,
  getAllCompanyFiles,
  getPLData,
};