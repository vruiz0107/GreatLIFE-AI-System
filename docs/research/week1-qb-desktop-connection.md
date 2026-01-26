# Week 1: QuickBooks Desktop Connection Research

**Date Started**: 01-14-26
**Goal**: Identify best method to connect N8N to QuickBooks Desktop Pro 2021

## Connection Methods to Research

### 1. QuickBooks Web Connector (QBWC)
- [ ] How it works
- [ ] N8N compatibility
- [ ] Limitations
- [ ] Setup complexity

### 2. QuickBooks Desktop API (QBXML)
- [ ] Direct API access
- [ ] Required setup
- [ ] Real-time vs batch processing

### 3. Third-Party Integrations
- [ ] Zapier/Make.com approach
- [ ] Cost implications
- [ ] Data security

### 4. File-Based Export/Import
- [ ] IIF files
- [ ] CSV exports
- [ ] Automation possibilities

## Research Notes

### 1. QuickBooks Web Connector (QBWC)
## no N8N node to QBD, but there are other ways:
QuickBooks Desktop (30+ files) 
    ↓
QuickBooks Web Connector (QBWC) - installed & runs on each server
    ↓
Custom SOAP Web Service (Python/Node.js middleware - I build this)
    ↓
PostgreSQL Database (stores extracted QB data)
    ↓
N8N workflows (self-hosted - the automation engine & error handling)
    ↓
Excel reports (generated from clean data & can swap for web dashboard in phase 2)

## Tech Stack
QBWC: Free, comes with QB Desktop
Node.js + Express: For SOAP web service (middleware)
qbws npm package: Node.js library for QBWC communication
N8N Community Edition: Self-hosted, free
PostgreSQL: Free, enterprise-grade database
ExcelJS: Node.js library to generate Excel files programmatically
Tech Stack Cost: $0 except for possible server hosting if needed

Why This Works ^^
QBWC is Intuit's official tool for third-party integrations with QB Desktop
It uses QBXML (XML-based query language) to extract data
You control the middleware, so it's free and customizable
N8N can trigger and receive data from your middleware via webhooks/APIs

### 2. QuickBooks Desktop API (QBXML)
QBXML (QuickBooks XML) is the actual query language used to communicate with QuickBooks Desktop. It's not separate from QBWC - QBWC uses QBXML.
Think of it this way:
QBWC = The delivery truck (transport mechanism)
QBXML = The packages being delivered (the actual queries and data)

How QBXML Works
You send XML-formatted requests to QuickBooks Desktop asking for data or to modify records:
Example QBXML Request (Get Customer List):
xml<?xml version="1.0" encoding="utf-8"?>
<?qbxml version="13.0"?>
<QBXML>
  <QBXMLMsgsRq onError="stopOnError">
    <CustomerQueryRq>
      <MaxReturned>100</MaxReturned>
    </CustomerQueryRq>
  </QBXMLMsgsRq>
</QBXML>
```
QuickBooks processes this and returns XML with the customer data.

Note: There is NO direct API access to QB Desktop
The only options are:
1. **QBWC (SOAP-based)** - What we're using ✅
2. **QuickBooks SDK** - Requires running code directly on the QB machine (not ideal for remote automation)
3. **COM/ActiveX** - Windows-only, requires local installation (terrible for your use case)
**For remote automation across 30+ files, QBWC is the ONLY practical option.**

### Required Setup
To use QBXML via QBWC, you need:
1. **QuickBooks Web Connector** installed on each QB server (free download from Intuit)
2. **Your SOAP web service** (the Node.js middleware we're building)
3. **QWC file** - Configuration file that tells QBWC where your web service is
4. **QBXML queries** - The actual XML requests you send

### Real-Time vs Batch Processing
**QBXML via QBWC is BATCH PROCESSING ONLY:**
- QBWC runs on a **schedule** (every 1 minute minimum, or hourly, daily, etc.)
- Each "session" can include multiple QBXML requests
- QB Desktop must be **open** but not actively being used by a human
- **Not real-time** - there's always a delay between data changes and your system seeing them

**Why This Matters for GreatLIFE:**
- Nightly report generation = Perfect for batch processing ✅
- Real-time inventory updates = Would be challenging (but doable with 1-minute polling)
- Your Phase 1 deliverable (automated reports) = Batch is ideal ✅

### QBXML Capabilities
You can query almost everything in QB Desktop:
**Financial Reports:**
- GeneralLedger
- ProfitAndLoss
- BalanceSheet
- CashFlowStatement
- ARAgingReport
**Transaction Data:**
- Invoices
- Bills
- Payments
- Journal Entries
- Purchases
**Master Data:**
- Customers
- Vendors
- Items
- Employees
- Accounts (Chart of Accounts)

### QBXML Limitations
1. **Version-specific** - QB Desktop 2021 supports QBXML version 13.0 or 14.0 (you'll confirm with GreatLIFE)
2. **Complex queries can be slow** - Large datasets take time to extract
3. **Single-threaded** - One QBWC session per company file at a time
4. **Company file must be open** - Can't query closed files
5. **User must be logged in** - Admin or user with proper permissions


### 3. Third-Party Integrations
unusable in our case - must use above set up

### 4. File-Based Export/Import
can be an okay plan b, but no plan b unless abosolutely necessary


## Decision Framework

**Priority criteria**:
1. Reliability for 30+ company files
2. Automation capability
3. Cost (should be $0 or minimal)
4. Security for financial data
5. Maintenance overhead

## Next Steps

- [ ] Test chosen method with 1 company file
- [ ] Document setup process
- [ ] Identify potential issues