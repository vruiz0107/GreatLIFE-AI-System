const config = require('./config');

// QBWC Service - implements SOAP endpoints that QBWC expects

class QBWCService {
  constructor() {
    this.tickets = new Map(); // Store session tickets
    this.requestQueue = []; // Queue of QBXML requests to send
  }

  // QBWC calls this when it first connects
  async serverVersion() {
    console.log('📞 QBWC requested serverVersion');
    return {
      serverVersionResult: '1.0.0'
    };
  }

  // QBWC calls this when closing connection
  async closeConnection(args) {
    const ticket = args.ticket;
    console.log(`📞 QBWC closing connection for ticket: ${ticket}`);
    
    this.tickets.delete(ticket);
    
    return {
      closeConnectionResult: 'Connection closed successfully'
    };
  }

  // QBWC calls this to authenticate
  async authenticate(args) {
    const { strUserName, strPassword } = args;
    
    console.log(`📞 QBWC authentication attempt - Username: ${strUserName}`);
    
    // Validate credentials
    if (strUserName === config.qbwc.username && strPassword === config.qbwc.password) {
      // Generate session ticket
      const ticket = this.generateTicket();
      this.tickets.set(ticket, {
        username: strUserName,
        connectedAt: new Date(),
        requests: []
      });
      
      console.log(`✅ Authentication successful - Ticket: ${ticket}`);
      
      // Return ticket and optional company file path
      return {
        authenticateResult: [ticket, config.qbwc.companyFile || '']
      };
    } else {
      console.log('❌ Authentication failed - Invalid credentials');
      return {
        authenticateResult: ['nvu', ''] // 'nvu' = not valid user
      };
    }
  }

  // QBWC calls this to check client version compatibility
  async clientVersion(args) {
    const { strVersion } = args;
    console.log(`📞 QBWC client version check: ${strVersion}`);
    
    // Return empty string to accept any version
    // Or return "W:version" for warning, "E:version" for error
    return {
      clientVersionResult: ''
    };
  }

  // QBWC calls this to get the next request to send to QuickBooks
  async sendRequestXML(args) {
    const { ticket, strHCPResponse, strCompanyFileName, qbXMLCountry, qbXMLMajorVers, qbXMLMinorVers } = args;
    
    console.log(`📞 QBWC requesting next XML request`);
    console.log(`   Company: ${strCompanyFileName}`);
    console.log(`   QB Version: ${qbXMLMajorVers}.${qbXMLMinorVers}`);
    
    const session = this.tickets.get(ticket);
    if (!session) {
      console.log('❌ Invalid ticket');
      return { sendRequestXMLResult: '' };
    }

    // If we have requests in queue, send the next one
    if (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      session.requests.push(request);
      
      console.log(`📤 Sending QBXML request: ${request.type}`);
      return {
        sendRequestXMLResult: request.xml
      };
    }
    
    // No more requests - return empty string to end session
    console.log('✅ No more requests - ending session');
    return {
      sendRequestXMLResult: ''
    };
  }

  // QBWC calls this with QuickBooks' response to our request
  async receiveResponseXML(args) {
    const { ticket, response, hresult, message } = args;
    
    console.log(`📞 QBWC received response from QuickBooks`);
    
    const session = this.tickets.get(ticket);
    if (!session) {
      console.log('❌ Invalid ticket');
      return { receiveResponseXMLResult: -1 };
    }

    // Check for errors
    if (hresult) {
      console.error(`❌ QuickBooks returned error: ${message}`);
      return { receiveResponseXMLResult: -1 };
    }

    // Process the response
    console.log(`✅ Received QBXML response (${response.length} bytes)`);
    console.log('📦 Response preview:', response.substring(0, 200) + '...');
    
    // TODO: In next phase, we'll parse this response and store in database
    // For now, just log it
    
    // Return percentage complete (100 = done, 0-99 = continue)
    const percentComplete = this.requestQueue.length === 0 ? 100 : 50;
    
    return {
      receiveResponseXMLResult: percentComplete
    };
  }

  // QBWC calls this to get last error
  async getLastError(args) {
    const { ticket } = args;
    console.log(`📞 QBWC requesting last error for ticket: ${ticket}`);
    
    return {
      getLastErrorResult: 'No errors'
    };
  }

  // QBWC calls this for connection error
  async connectionError(args) {
    const { ticket, hresult, message } = args;
    console.log(`📞 QBWC connection error: ${message}`);
    
    return {
      connectionErrorResult: 'done'
    };
  }

  // Helper: Generate unique session ticket
  generateTicket() {
    return `TICKET-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Helper: Add request to queue
  addRequest(requestType, qbxmlString) {
    this.requestQueue.push({
      type: requestType,
      xml: qbxmlString,
      addedAt: new Date()
    });
    console.log(`➕ Added ${requestType} request to queue (${this.requestQueue.length} total)`);
  }

  // Get WSDL definition
  getWSDL() {
    return `<?xml version="1.0" encoding="utf-8"?>
<definitions name="QBWebConnectorSvc"
  targetNamespace="http://developer.intuit.com/"
  xmlns:tns="http://developer.intuit.com/"
  xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/"
  xmlns="http://schemas.xmlsoap.org/wsdl/">
  
  <types>
    <schema targetNamespace="http://developer.intuit.com/" xmlns="http://www.w3.org/2001/XMLSchema">
      <element name="authenticateResult">
        <complexType>
          <sequence>
            <element name="string" type="string" minOccurs="0" maxOccurs="2"/>
          </sequence>
        </complexType>
      </element>
    </schema>
  </types>

  <message name="serverVersionRequest"/>
  <message name="serverVersionResponse">
    <part name="serverVersionResult" type="xsd:string"/>
  </message>

  <message name="clientVersionRequest">
    <part name="strVersion" type="xsd:string"/>
  </message>
  <message name="clientVersionResponse">
    <part name="clientVersionResult" type="xsd:string"/>
  </message>

  <message name="authenticateRequest">
    <part name="strUserName" type="xsd:string"/>
    <part name="strPassword" type="xsd:string"/>
  </message>
  <message name="authenticateResponse">
    <part name="authenticateResult" element="tns:authenticateResult"/>
  </message>

  <message name="sendRequestXMLRequest">
    <part name="ticket" type="xsd:string"/>
    <part name="strHCPResponse" type="xsd:string"/>
    <part name="strCompanyFileName" type="xsd:string"/>
    <part name="qbXMLCountry" type="xsd:string"/>
    <part name="qbXMLMajorVers" type="xsd:string"/>
    <part name="qbXMLMinorVers" type="xsd:string"/>
  </message>
  <message name="sendRequestXMLResponse">
    <part name="sendRequestXMLResult" type="xsd:string"/>
  </message>

  <message name="receiveResponseXMLRequest">
    <part name="ticket" type="xsd:string"/>
    <part name="response" type="xsd:string"/>
    <part name="hresult" type="xsd:string"/>
    <part name="message" type="xsd:string"/>
  </message>
  <message name="receiveResponseXMLResponse">
    <part name="receiveResponseXMLResult" type="xsd:int"/>
  </message>

  <message name="closeConnectionRequest">
    <part name="ticket" type="xsd:string"/>
  </message>
  <message name="closeConnectionResponse">
    <part name="closeConnectionResult" type="xsd:string"/>
  </message>

  <message name="getLastErrorRequest">
    <part name="ticket" type="xsd:string"/>
  </message>
  <message name="getLastErrorResponse">
    <part name="getLastErrorResult" type="xsd:string"/>
  </message>

  <message name="connectionErrorRequest">
    <part name="ticket" type="xsd:string"/>
    <part name="hresult" type="xsd:string"/>
    <part name="message" type="xsd:string"/>
  </message>
  <message name="connectionErrorResponse">
    <part name="connectionErrorResult" type="xsd:string"/>
  </message>

  <portType name="QBWebConnectorSvcSoap">
    <operation name="serverVersion">
      <input message="tns:serverVersionRequest"/>
      <output message="tns:serverVersionResponse"/>
    </operation>
    <operation name="clientVersion">
      <input message="tns:clientVersionRequest"/>
      <output message="tns:clientVersionResponse"/>
    </operation>
    <operation name="authenticate">
      <input message="tns:authenticateRequest"/>
      <output message="tns:authenticateResponse"/>
    </operation>
    <operation name="sendRequestXML">
      <input message="tns:sendRequestXMLRequest"/>
      <output message="tns:sendRequestXMLResponse"/>
    </operation>
    <operation name="receiveResponseXML">
      <input message="tns:receiveResponseXMLRequest"/>
      <output message="tns:receiveResponseXMLResponse"/>
    </operation>
    <operation name="closeConnection">
      <input message="tns:closeConnectionRequest"/>
      <output message="tns:closeConnectionResponse"/>
    </operation>
    <operation name="getLastError">
      <input message="tns:getLastErrorRequest"/>
      <output message="tns:getLastErrorResponse"/>
    </operation>
    <operation name="connectionError">
      <input message="tns:connectionErrorRequest"/>
      <output message="tns:connectionErrorResponse"/>
    </operation>
  </portType>

  <binding name="QBWebConnectorSvcSoap" type="tns:QBWebConnectorSvcSoap">
    <soap:binding style="rpc" transport="http://schemas.xmlsoap.org/soap/http"/>
    
    <operation name="serverVersion">
      <soap:operation soapAction="http://developer.intuit.com/serverVersion"/>
      <input><soap:body use="encoded" namespace="http://developer.intuit.com/" encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"/></input>
      <output><soap:body use="encoded" namespace="http://developer.intuit.com/" encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"/></output>
    </operation>
    
    <operation name="clientVersion">
      <soap:operation soapAction="http://developer.intuit.com/clientVersion"/>
      <input><soap:body use="encoded" namespace="http://developer.intuit.com/" encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"/></input>
      <output><soap:body use="encoded" namespace="http://developer.intuit.com/" encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"/></output>
    </operation>
    
    <operation name="authenticate">
      <soap:operation soapAction="http://developer.intuit.com/authenticate"/>
      <input><soap:body use="encoded" namespace="http://developer.intuit.com/" encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"/></input>
      <output><soap:body use="encoded" namespace="http://developer.intuit.com/" encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"/></output>
    </operation>
    
    <operation name="sendRequestXML">
      <soap:operation soapAction="http://developer.intuit.com/sendRequestXML"/>
      <input><soap:body use="encoded" namespace="http://developer.intuit.com/" encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"/></input>
      <output><soap:body use="encoded" namespace="http://developer.intuit.com/" encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"/></output>
    </operation>
    
    <operation name="receiveResponseXML">
      <soap:operation soapAction="http://developer.intuit.com/receiveResponseXML"/>
      <input><soap:body use="encoded" namespace="http://developer.intuit.com/" encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"/></input>
      <output><soap:body use="encoded" namespace="http://developer.intuit.com/" encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"/></output>
    </operation>
    
    <operation name="closeConnection">
      <soap:operation soapAction="http://developer.intuit.com/closeConnection"/>
      <input><soap:body use="encoded" namespace="http://developer.intuit.com/" encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"/></input>
      <output><soap:body use="encoded" namespace="http://developer.intuit.com/" encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"/></output>
    </operation>
    
    <operation name="getLastError">
      <soap:operation soapAction="http://developer.intuit.com/getLastError"/>
      <input><soap:body use="encoded" namespace="http://developer.intuit.com/" encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"/></input>
      <output><soap:body use="encoded" namespace="http://developer.intuit.com/" encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"/></output>
    </operation>
    
    <operation name="connectionError">
      <soap:operation soapAction="http://developer.intuit.com/connectionError"/>
      <input><soap:body use="encoded" namespace="http://developer.intuit.com/" encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"/></input>
      <output><soap:body use="encoded" namespace="http://developer.intuit.com/" encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"/></output>
    </operation>
  </binding>

  <service name="QBWebConnectorSvc">
    <documentation>QuickBooks Web Connector Service</documentation>
    <port name="QBWebConnectorSvcSoap" binding="tns:QBWebConnectorSvcSoap">
      <soap:address location="http://localhost:8080/wsdl"/>
    </port>
  </service>
</definitions>`;
  }
}

module.exports = QBWCService;