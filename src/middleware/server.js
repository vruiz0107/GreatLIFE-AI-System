const express = require('express');
const bodyParser = require('body-parser');
const soap = require('soap');
const config = require('./config');
const QBWCService = require('./qbwc-service');

const app = express();
const qbwcService = new QBWCService();

// Middleware
app.use(bodyParser.raw({ type: 'text/xml', limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: config.app.appName,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// SOAP service endpoints - bind the service methods
const serviceObject = {
  QBWebConnectorSvcSoap: {
    serverVersion: qbwcService.serverVersion.bind(qbwcService),
    clientVersion: qbwcService.clientVersion.bind(qbwcService),
    authenticate: qbwcService.authenticate.bind(qbwcService),
    sendRequestXML: qbwcService.sendRequestXML.bind(qbwcService),
    receiveResponseXML: qbwcService.receiveResponseXML.bind(qbwcService),
    closeConnection: qbwcService.closeConnection.bind(qbwcService),
    getLastError: qbwcService.getLastError.bind(qbwcService),
    connectionError: qbwcService.connectionError.bind(qbwcService)
  }
};

// Serve WSDL directly
app.get('/wsdl', (req, res) => {
    res.set('Content-Type', 'text/xml');
    res.send(qbwcService.getWSDL());
  });
  
  // SOAP endpoint
  app.post('/wsdl', bodyParser.text({ type: 'text/xml' }), async (req, res) => {
    try {
      // For now, just acknowledge SOAP requests
      // We'll implement full SOAP handling in next phase
      console.log('📨 Received SOAP request');
      res.set('Content-Type', 'text/xml');
      res.send('<?xml version="1.0"?><response>OK</response>');
    } catch (error) {
      console.error('SOAP error:', error);
      res.status(500).send('Error processing SOAP request');
    }
  });

// Start Express server
app.listen(config.server.port, () => {
  console.log('\n' + '='.repeat(60));
  console.log(`🚀 ${config.app.appName}`);
  console.log('='.repeat(60));
  console.log(`📡 QBWC SOAP Service running on port ${config.server.port}`);
  console.log(`🔗 WSDL URL: http://${config.server.host}:${config.server.port}/wsdl`);
  console.log(`🔗 Health Check: http://${config.server.host}:${config.server.port}/health`);
  console.log('='.repeat(60));
  console.log(`📋 Configuration:`);
  console.log(`   - QB Min Version: ${config.quickbooks.minQBVersion}`);
  console.log(`   - QB Max Version: ${config.quickbooks.maxQBVersion}`);
  console.log(`   - Username: ${config.qbwc.username}`);
  console.log('='.repeat(60));
  console.log('✅ Ready to receive QBWC connections\n');
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Rejection:', error);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down gracefully...');
  process.exit(0);
});

module.exports = app;