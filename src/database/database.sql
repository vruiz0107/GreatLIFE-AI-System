-- Company Files Registry
CREATE TABLE company_files (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    qb_version VARCHAR(50) NOT NULL,
    location VARCHAR(100) NOT NULL,
    file_path VARCHAR(500),
    qb_type VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_synced_at TIMESTAMP
);

-- Chart of Accounts
CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    company_file_id INTEGER REFERENCES company_files(id),
    account_list_id VARCHAR(50) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(100),
    account_number VARCHAR(50),
    description TEXT,
    balance DECIMAL(15, 2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_file_id, account_list_id)
);

-- Profit & Loss Data
CREATE TABLE pl_data (
    id SERIAL PRIMARY KEY,
    company_file_id INTEGER REFERENCES company_files(id),
    account_id INTEGER REFERENCES accounts(id),
    report_date DATE NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    report_type VARCHAR(50) DEFAULT 'P&L',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_file_id, account_id, report_date, period_start, period_end)
);

-- Balance Sheet Data
CREATE TABLE balance_sheet_data (
    id SERIAL PRIMARY KEY,
    company_file_id INTEGER REFERENCES company_files(id),
    account_id INTEGER REFERENCES accounts(id),
    report_date DATE NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    account_category VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_file_id, account_id, report_date)
);

-- AR Aging Data
CREATE TABLE ar_aging_data (
    id SERIAL PRIMARY KEY,
    company_file_id INTEGER REFERENCES company_files(id),
    customer_name VARCHAR(255) NOT NULL,
    report_date DATE NOT NULL,
    current_amount DECIMAL(15, 2) DEFAULT 0,
    days_1_30 DECIMAL(15, 2) DEFAULT 0,
    days_31_60 DECIMAL(15, 2) DEFAULT 0,
    days_61_90 DECIMAL(15, 2) DEFAULT 0,
    days_over_90 DECIMAL(15, 2) DEFAULT 0,
    total_amount DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_file_id, customer_name, report_date)
);

-- Customers
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    company_file_id INTEGER REFERENCES company_files(id),
    customer_list_id VARCHAR(50) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    balance DECIMAL(15, 2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_file_id, customer_list_id)
);

-- Indexes for Performance
CREATE INDEX idx_company_files_location ON company_files(location);
CREATE INDEX idx_company_files_active ON company_files(is_active);
CREATE INDEX idx_accounts_company ON accounts(company_file_id);
CREATE INDEX idx_pl_data_date ON pl_data(report_date);
CREATE INDEX idx_pl_data_company ON pl_data(company_file_id);
CREATE INDEX idx_balance_sheet_date ON balance_sheet_data(report_date);
CREATE INDEX idx_balance_sheet_company ON balance_sheet_data(company_file_id);
CREATE INDEX idx_ar_aging_date ON ar_aging_data(report_date);
CREATE INDEX idx_ar_aging_company ON ar_aging_data(company_file_id);
CREATE INDEX idx_customers_company ON customers(company_file_id);ls