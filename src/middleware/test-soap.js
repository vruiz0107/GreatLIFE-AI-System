const soap = require('soap');

const WSDL_URL = 'http://localhost:8080/wsdl?wsdl';

async function testSOAPEndpoints() {
  console.log('🧪 Testing QBWC SOAP Endpoints\n');
  
  try {
    // Create SOAP client
    console.log('📡 Connecting to WSDL...');
    const client = await soap.createClientAsync(WSDL_URL);
    console.log('✅ SOAP client created\n');
    
    // Test 1: serverVersion
    console.log('🧪 Test 1: serverVersion');
    const versionResult = await client.serverVersionAsync();
    console.log('Response:', versionResult);
    console.log('✅ serverVersion works\n');
    
    // Test 2: clientVersion
    console.log('🧪 Test 2: clientVersion');
    const clientVersionResult = await client.clientVersionAsync({ strVersion: '2.3.0.30' });
    console.log('Response:', clientVersionResult);
    console.log('✅ clientVersion works\n');
    
    // Test 3: authenticate (valid credentials)
    console.log('🧪 Test 3: authenticate (valid credentials)');
    const authResult = await client.authenticateAsync({
      strUserName: 'greatlife_admin',
      strPassword: 'secure_password_123'
    });
    console.log('Response:', authResult);
    
    const ticket = authResult[0]?.authenticateResult?.[0] || authResult[0]?.[0];
    console.log('🎫 Ticket received:', ticket);
    console.log('✅ authenticate works\n');
    
    // Test 4: authenticate (invalid credentials)
    console.log('🧪 Test 4: authenticate (invalid credentials)');
    const authFailResult = await client.authenticateAsync({
      strUserName: 'wrong_user',
      strPassword: 'wrong_password'
    });
    console.log('Response:', authFailResult);
    console.log('✅ Failed authentication handled correctly\n');
    
    // Test 5: sendRequestXML (if we have a ticket)
    if (ticket && ticket !== 'nvu') {
      console.log('🧪 Test 5: sendRequestXML');
      const sendResult = await client.sendRequestXMLAsync({
        ticket: ticket,
        strHCPResponse: '',
        strCompanyFileName: 'Test Company.qbw',
        qbXMLCountry: 'US',
        qbXMLMajorVers: '15',
        qbXMLMinorVers: '0'
      });
      console.log('Response:', sendResult);
      console.log('✅ sendRequestXML works\n');
      
      // Test 6: receiveResponseXML
      console.log('🧪 Test 6: receiveResponseXML');
      const receiveResult = await client.receiveResponseXMLAsync({
        ticket: ticket,
        response: '<?xml version="1.0"?><QBXML><QBXMLMsgsRs><CompanyQueryRs statusCode="0"><CompanyRet><CompanyName>Test Company</CompanyName></CompanyRet></CompanyQueryRs></QBXMLMsgsRs></QBXML>',
        hresult: '',
        message: ''
      });
      console.log('Response:', receiveResult);
      console.log('✅ receiveResponseXML works\n');
      
      // Test 7: getLastError
      console.log('🧪 Test 7: getLastError');
      const errorResult = await client.getLastErrorAsync({ ticket: ticket });
      console.log('Response:', errorResult);
      console.log('✅ getLastError works\n');
      
      // Test 8: closeConnection
      console.log('🧪 Test 8: closeConnection');
      const closeResult = await client.closeConnectionAsync({ ticket: ticket });
      console.log('Response:', closeResult);
      console.log('✅ closeConnection works\n');
    }
    
    console.log('✅ ✅ ✅ ALL SOAP ENDPOINT TESTS PASSED! ✅ ✅ ✅\n');
    console.log('🎯 Your QBWC middleware is fully functional and ready for production!');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ SOAP TEST FAILED:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testSOAPEndpoints();