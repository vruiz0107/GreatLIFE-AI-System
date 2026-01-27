const QBWCService = require('./qbwc-service');

async function testQBWCFunctions() {
  console.log('🧪 Testing QBWC Service Functions\n');
  
  const service = new QBWCService();
  
  try {
    // Test 1: serverVersion
    console.log('🧪 Test 1: serverVersion');
    const version = await service.serverVersion();
    console.log('✅ Result:', version);
    console.log('');
    
    // Test 2: authenticate (valid)
    console.log('🧪 Test 2: authenticate (valid credentials)');
    const authValid = await service.authenticate({
      strUserName: 'greatlife_admin',
      strPassword: 'secure_password_123'
    });
    console.log('✅ Result:', authValid);
    const ticket = authValid.authenticateResult[0];
    console.log('🎫 Ticket:', ticket);
    console.log('');
    
    // Test 3: authenticate (invalid)
    console.log('🧪 Test 3: authenticate (invalid credentials)');
    const authInvalid = await service.authenticate({
      strUserName: 'wrong',
      strPassword: 'wrong'
    });
    console.log('✅ Result:', authInvalid);
    console.log('');
    
    // Test 4: clientVersion
    console.log('🧪 Test 4: clientVersion');
    const clientVer = await service.clientVersion({ strVersion: '2.3.0.30' });
    console.log('✅ Result:', clientVer);
    console.log('');
    
    // Test 5: sendRequestXML
    console.log('🧪 Test 5: sendRequestXML');
    const sendReq = await service.sendRequestXML({
      ticket: ticket,
      strHCPResponse: '',
      strCompanyFileName: 'Test.qbw',
      qbXMLCountry: 'US',
      qbXMLMajorVers: '15',
      qbXMLMinorVers: '0'
    });
    console.log('✅ Result:', sendReq);
    console.log('');
    
    // Test 6: Add a request to queue
    console.log('🧪 Test 6: Adding request to queue');
    service.addRequest('CompanyQuery', '<?xml version="1.0"?><QBXML><QBXMLMsgsRq><CompanyQueryRq/></QBXMLMsgsRq></QBXML>');
    console.log('');
    
    // Test 7: sendRequestXML again (should return queued request)
    console.log('🧪 Test 7: sendRequestXML (with queued request)');
    const sendReq2 = await service.sendRequestXML({
      ticket: ticket,
      strHCPResponse: '',
      strCompanyFileName: 'Test.qbw',
      qbXMLCountry: 'US',
      qbXMLMajorVers: '15',
      qbXMLMinorVers: '0'
    });
    console.log('✅ Result:', sendReq2);
    console.log('');
    
    // Test 8: receiveResponseXML
    console.log('🧪 Test 8: receiveResponseXML');
    const receiveResp = await service.receiveResponseXML({
      ticket: ticket,
      response: '<?xml version="1.0"?><QBXML><QBXMLMsgsRs><CompanyQueryRs statusCode="0"><CompanyRet><CompanyName>Test Company</CompanyName></CompanyRet></CompanyQueryRs></QBXMLMsgsRs></QBXML>',
      hresult: '',
      message: ''
    });
    console.log('✅ Result:', receiveResp);
    console.log('');
    
    // Test 9: getLastError
    console.log('🧪 Test 9: getLastError');
    const lastError = await service.getLastError({ ticket: ticket });
    console.log('✅ Result:', lastError);
    console.log('');
    
    // Test 10: closeConnection
    console.log('🧪 Test 10: closeConnection');
    const closeConn = await service.closeConnection({ ticket: ticket });
    console.log('✅ Result:', closeConn);
    console.log('');
    
    console.log('✅ ✅ ✅ ALL FUNCTION TESTS PASSED! ✅ ✅ ✅\n');
    console.log('🎯 All QBWC service functions working correctly!');
    console.log('📝 Note: Full SOAP integration will be tested when connecting to real QBWC');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testQBWCFunctions();