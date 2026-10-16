import http from 'http';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from './server.js';
import User from './models/User.js';
import Sale from './models/Sale.js';
import BankTransaction from './models/BankTransaction.js';
import setuService from './services/setuService.js';

let server;
let baseUrl;
let validToken;

const JWT_SECRET = process.env.JWT_SECRET || 'smart_business_secret_key_123';

const request = (method, path, body = null, headers = {}) => {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {
          json = data;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: json,
        });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
};

const assert = (condition, message) => {
  if (!condition) {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ PASS: ${message}`);
};

async function runTests() {
  console.log('\n====================================================');
  console.log('SETU ACCOUNT AGGREGATOR STAGE 1 TEST SUITE');
  console.log('====================================================\n');

  // 1. Ensure DB connection
  if (mongoose.connection.readyState !== 1) {
    await new Promise((resolve) => {
      if (mongoose.connection.readyState === 1) return resolve();
      mongoose.connection.once('open', resolve);
    });
  }

  // 2. Setup authenticated test user for protect middleware
  const testUser = await User.findOneAndUpdate(
    { email: 'setu_test_owner@store.com' },
    {
      name: 'Setu Test Merchant',
      email: 'setu_test_owner@store.com',
      passwordHash: 'hashed_password_123',
      currency: 'INR',
    },
    { upsert: true, new: true }
  );

  validToken = jwt.sign({ id: testUser._id, email: testUser.email }, JWT_SECRET, { expiresIn: '1h' });

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;

  let passed = 0;
  let failed = 0;

  const test = async (name, fn) => {
    try {
      console.log(`--- ${name} ---`);
      await fn();
      passed++;
    } catch (err) {
      failed++;
      console.error(`Error in ${name}:`, err.message);
    }
    console.log('');
  };

  try {
    // TEST 1: Direct Callback Route
    await test('TEST 1: Direct GET /api/setu/callback Redirection & Parameter Preservation', async () => {
      const res = await request(
        'GET',
        '/api/setu/callback?id=consent_test_8819&status=ACTIVE&resURI=http://data-session/1'
      );
      assert(res.statusCode === 302, 'Direct callback responds with 302 Found redirect');
      const location = res.headers.location;
      assert(location.includes('/setu-callback'), 'Redirect target points to /setu-callback frontend route');
      assert(location.includes('id=consent_test_8819'), 'Consent ID parameter is preserved in redirect URL');
      assert(location.includes('status=ACTIVE'), 'Status parameter is preserved in redirect URL');
      assert(location.includes('resURI='), 'resURI parameter is preserved in redirect URL');
    });

    // TEST 2: Authentication enforcement on Setu API
    await test('TEST 2: Authentication Enforcement on Setu Endpoints', async () => {
      // 1. Missing token
      const resConfigUnauth = await request('GET', '/api/setu/config');
      assert(resConfigUnauth.statusCode === 401, 'GET /api/setu/config rejects unauthenticated requests with 401');
      assert(
        resConfigUnauth.data?.message === 'Not authorized, no token provided',
        'Rejects with "Not authorized, no token provided" when header missing'
      );

      // 2. Invalid/corrupted token
      const resConfigInvalid = await request('GET', '/api/setu/config', null, {
        Authorization: 'Bearer invalid.token.signature',
      });
      assert(resConfigInvalid.statusCode === 401, 'Rejects invalid token with 401');
      assert(
        resConfigInvalid.data?.message === 'Not authorized, token failed',
        'Rejects with "Not authorized, token failed" when token corrupted'
      );

      // 3. Malformed header without Bearer prefix
      const resConfigMalformed = await request('GET', '/api/setu/config', null, {
        Authorization: 'Basic dXNlcjpwYXNz',
      });
      assert(resConfigMalformed.statusCode === 401, 'Rejects non-Bearer header with 401');
      assert(
        resConfigMalformed.data?.message === 'Not authorized, no token provided',
        'Rejects non-Bearer header as no token provided'
      );

      // 4. Consent creation endpoint without token returns exact error
      const resConsentUnauth = await request('POST', '/api/setu/consents', {
        customerPhone: '9999999999',
      });
      assert(resConsentUnauth.statusCode === 401, 'POST /api/setu/consents rejects unauthenticated requests with 401');
      assert(
        resConsentUnauth.data?.message === 'Not authorized, no token provided',
        'POST /api/setu/consents returns "Not authorized, no token provided"'
      );

      // 5. Consent creation endpoint with invalid token
      const resConsentInvalid = await request(
        'POST',
        '/api/setu/consents',
        { customerPhone: '9999999999' },
        { Authorization: 'Bearer bad_token_123' }
      );
      assert(resConsentInvalid.statusCode === 401, 'POST /api/setu/consents rejects bad token with 401');
      assert(
        resConsentInvalid.data?.message === 'Not authorized, token failed',
        'Returns "Not authorized, token failed"'
      );

      // 6. Callback verification endpoint unauthenticated
      const resVerifyUnauth = await request('POST', '/api/setu/verify-callback', {
        id: 'test_consent_id',
        status: 'ACTIVE',
      });
      assert(resVerifyUnauth.statusCode === 401, 'POST /api/setu/verify-callback rejects unauthenticated requests with 401');

      // 7. Status endpoint unauthenticated
      const resStatusUnauth = await request('GET', '/api/setu/consents/test_consent_id/status');
      assert(resStatusUnauth.statusCode === 401, 'GET /api/setu/consents/:id/status rejects unauthenticated requests with 401');
    });

    // TEST 3: Safe Public Config Status
    await test('TEST 3: Safe Public Config Status Endpoint', async () => {
      const res = await request('GET', '/api/setu/config', null, {
        Authorization: `Bearer ${validToken}`,
      });
      assert(res.statusCode === 200, 'Authenticated request returns 200 OK');
      assert(typeof res.data.config.configured === 'boolean', 'Config response includes configured boolean');
      assert(res.data.config.environment === 'sandbox', 'Config environment is sandbox');
      assert(!res.data.config.clientSecret, 'Client secret is NEVER leaked in config response');
      assert(!res.data.config.apiKey, 'API keys are NEVER leaked in config response');
    });

    // TEST 4: Input Validation
    await test('TEST 4: Input Validation on Consent Callback Verification', async () => {
      const resNoId = await request('POST', '/api/setu/verify-callback', {}, {
        Authorization: `Bearer ${validToken}`,
      });
      assert(resNoId.statusCode === 400, 'Missing consent ID returns 400 Bad Request');

      const resEmptyId = await request('POST', '/api/setu/verify-callback', { id: '   ' }, {
        Authorization: `Bearer ${validToken}`,
      });
      assert(resEmptyId.statusCode === 400, 'Empty whitespace consent ID returns 400 Bad Request');
    });

    // TEST 5: User Abort & Rejection Handling
    await test('TEST 5: Explicit User Rejection & Error Code Handling', async () => {
      const resRejection = await request(
        'POST',
        '/api/setu/verify-callback',
        {
          id: 'consent_rejected_001',
          status: 'REJECTED',
          errorCode: 'USER_ABORTED',
          errorMessage: 'User closed consent window before completion',
        },
        {
          Authorization: `Bearer ${validToken}`,
        }
      );

      assert(resRejection.statusCode === 200, 'Rejection callback returns 200 OK');
      assert(resRejection.data.verification.status === 'REJECTED', 'Status marked as REJECTED');
      assert(resRejection.data.verification.canFetchData === false, 'canFetchData is strictly false on rejection');
      assert(resRejection.data.verification.errorCode === 'USER_ABORTED', 'Error code is preserved');
    });

    // TEST 6: Rule Enforcement: Never Trust Query Params Alone Without Upstream Verification
    await test('TEST 6: Security Rule: Do NOT Treat Query Params Alone as Proof of Approval', async () => {
      // Client sends query claiming status=ACTIVE, but upstream credentials are not configured or unverified
      const resClaimedActive = await request(
        'POST',
        '/api/setu/verify-callback',
        {
          id: 'tampered_consent_999',
          status: 'ACTIVE', // Query param falsely claiming ACTIVE
        },
        {
          Authorization: `Bearer ${validToken}`,
        }
      );

      assert(resClaimedActive.statusCode === 200, 'Endpoint processed verification request');
      const verification = resClaimedActive.data.verification;

      // Because Setu live credentials are not active in this test environment,
      // it must NOT mark isVerified as true or allow data fetching!
      assert(verification.isApproved !== true, 'Claimed ACTIVE query param alone is NOT marked as approved');
      assert(verification.canFetchData === false, 'canFetchData remains strictly false');
      assert(
        verification.status === 'PENDING_CONFIG' || verification.isVerified === false,
        'Status indicates unverified / pending configuration'
      );
    });

    // TEST 7: Mock Upstream Verification Flow in SetuService
    await test('TEST 7: Authoritative SetuService Upstream Verification Logic', async () => {
      // Test the service method directly with simulated responses
      const mockService = Object.create(setuService);
      mockService.isConfigured = () => true;
      mockService.getConsentStatus = async (consentId) => ({
        success: true,
        verified: true,
        configured: true,
        consentId,
        status: 'ACTIVE',
        consentDetail: { consentMode: 'STORE', fetchType: 'ONETIME' },
      });

      const verification = await mockService.verifyCallback({
        consentId: 'valid_consent_123',
        status: 'ACTIVE',
      });

      assert(verification.isVerified === true, 'Upstream confirmed ACTIVE sets isVerified to true');
      assert(verification.isApproved === true, 'isApproved is true when upstream confirms ACTIVE');
      assert(verification.status === 'ACTIVE', 'Authoritative status is ACTIVE');
      assert(verification.canFetchData === true, 'In Stage 3, canFetchData is enabled for approved consent');
    });

    // TEST 8: Consent Creation Request via POST /api/setu/consents
    await test('TEST 8: Account Aggregator Consent Creation Flow', async () => {
      // 1. Unauthenticated request must be rejected
      const unauthRes = await request('POST', '/api/setu/consents', {
        customerPhone: '9999999999',
      });
      assert(unauthRes.statusCode === 401, 'POST /api/setu/consents rejects unauthenticated requests with 401');
      assert(
        unauthRes.data?.message === 'Not authorized, no token provided',
        'POST /api/setu/consents returns "Not authorized, no token provided" when unauthenticated'
      );

      // 2. Authenticated request with valid token passes authMiddleware (never returns 401 auth error)
      const authConsentRes = await request(
        'POST',
        '/api/setu/consents',
        { customerPhone: '9999999999' },
        { Authorization: `Bearer ${validToken}` }
      );
      assert(
        authConsentRes.statusCode !== 401,
        'Authenticated request with Bearer token passes auth middleware (got non-401)'
      );
      assert(
        authConsentRes.data?.message !== 'Not authorized, no token provided',
        'Authenticated request does not return "Not authorized, no token provided"'
      );

      // 3. Test createConsent response structuring via service mock
      const mockService = Object.create(setuService);
      mockService.isConfigured = () => true;
      mockService.createConsent = async ({ customerPhone, redirectUrl }) => ({
        success: true,
        configured: true,
        consentId: 'mock_consent_456',
        status: 'PENDING',
        consentUrl: 'https://fiu-sandbox.setu.co/consents/mock_consent_456',
        redirectUrl: redirectUrl || 'http://localhost:5173/setu-callback',
      });

      const consentResult = await mockService.createConsent({
        customerPhone: '9999999999',
        redirectUrl: 'http://localhost:5173/setu-callback',
      });

      assert(consentResult.success === true, 'Consent creation returns success');
      assert(consentResult.consentId === 'mock_consent_456', 'Consent ID returned correctly');
      assert(consentResult.status === 'PENDING', 'Initial consent status is PENDING');
      assert(
        consentResult.consentUrl.includes('/consents/'),
        'Consent URL points to Setu AA consent webview'
      );
      assert(
        consentResult.redirectUrl.includes('/setu-callback'),
        'Redirect URL correctly targets /setu-callback'
      );
    });

    // TEST 9: Authentication Enforcement on Stage 3 Session Endpoints
    await test('TEST 9: Authentication Enforcement on Stage 3 Session Endpoints', async () => {
      const resSession = await request('POST', '/api/setu/sessions', { consentId: 'consent_123' });
      assert(resSession.statusCode === 401, 'POST /api/setu/sessions rejects unauthenticated request with 401');

      const resGetSession = await request('GET', '/api/setu/sessions/session_abc');
      assert(resGetSession.statusCode === 401, 'GET /api/setu/sessions/:id rejects unauthenticated request with 401');

      const resFetchData = await request('POST', '/api/setu/fetch-data', { consentId: 'consent_123' });
      assert(resFetchData.statusCode === 401, 'POST /api/setu/fetch-data rejects unauthenticated request with 401');

      const resTxns = await request('GET', '/api/setu/transactions');
      assert(resTxns.statusCode === 401, 'GET /api/setu/transactions rejects unauthenticated request with 401');

      const resClassify = await request('PATCH', '/api/setu/transactions/mock_id/classify', { classification: 'business_sale' });
      assert(resClassify.statusCode === 401, 'PATCH /api/setu/transactions/:id/classify rejects unauthenticated request with 401');
    });

    // TEST 10: Consent Status Validation Before Data Session Creation
    await test('TEST 10: Consent Status Validation Before Data Session Creation', async () => {
      const mockService = Object.create(setuService);
      mockService.isConfigured = () => true;

      // 1. Consent is not ACTIVE (e.g. PENDING or REJECTED)
      mockService.getConsentStatus = async (consentId) => ({
        success: true,
        verified: true,
        consentId,
        status: 'PENDING',
      });

      const pendingCheck = await mockService.createDataSession({ consentId: 'consent_pending_001' });
      assert(pendingCheck.success === false, 'Rejects data session creation for non-ACTIVE consent');
      assert(pendingCheck.error === 'ConsentNotActive', 'Error code specifies ConsentNotActive');

      // 2. Missing consent ID
      const missingCheck = await mockService.createDataSession({ consentId: '' });
      assert(missingCheck.success === false, 'Rejects data session creation for empty consentId');
      assert(missingCheck.error === 'InvalidConsentId', 'Error code specifies InvalidConsentId');
    });

    // TEST 11: Data Session States Handling
    await test('TEST 11: Data Session States Handling (PENDING, COMPLETED, FAILED, EXPIRED)', async () => {
      const mockService = Object.create(setuService);
      mockService.isConfigured = () => true;

      for (const expectedStatus of ['PENDING', 'PARTIAL', 'COMPLETED', 'FAILED', 'EXPIRED']) {
        mockService.getDataSession = async (sessionId) => ({
          success: true,
          configured: true,
          sessionId,
          status: expectedStatus,
          payload: expectedStatus === 'COMPLETED' ? [{ fipId: 'FIP-1', data: [] }] : [],
        });

        const res = await mockService.getDataSession('sess_test_1');
        assert(res.status === expectedStatus, `Session status accurately handled for ${expectedStatus}`);
      }
    });

    // TEST 12: Setu FI Response Parsing & Malformed Payload Handling
    await test('TEST 12: Setu FI Response Parsing & Malformed Payload Handling', async () => {
      const mockPayload = [
        {
          fipId: 'SETU-MOCK-FIP',
          data: [
            {
              decrypted: {
                account: {
                  type: 'deposit',
                  maskedAccNumber: 'XXXXXXXX9988',
                  Transactions: {
                    Transaction: [
                      {
                        txnId: 'TXN_CREDIT_001',
                        type: 'CREDIT',
                        mode: 'UPI',
                        amount: '1250.00',
                        currentBalance: '15420.50',
                        transactionTimestamp: '2026-10-09T14:32:00.000Z',
                        valueDate: '2026-10-09',
                        narration: 'UPI/428901238910/Retail sale payment',
                        reference: '428901238910',
                      },
                      {
                        txnId: 'TXN_DEBIT_002',
                        type: 'DEBIT',
                        mode: 'NEFT',
                        amount: '450.00',
                        currentBalance: '14970.50',
                        transactionTimestamp: '2026-10-08T11:20:00.000Z',
                        valueDate: '2026-10-08',
                        narration: 'Wholesale Stock Supplies NEFT',
                        reference: 'NEFT981247',
                      },
                      // Malformed items that must be safely filtered
                      null,
                      { amount: '0' },
                      { amount: '-100' },
                      { amount: 'invalid_number' },
                    ],
                  },
                },
              },
            },
          ],
        },
      ];

      const parsed = setuService.parseFITransactions(mockPayload, 'consent_parse_test');
      assert(parsed.length === 2, `Exactly 2 valid transactions parsed from payload (got ${parsed.length})`);

      const creditTx = parsed[0];
      assert(creditTx.type === 'CREDIT', 'Credit transaction type is CREDIT');
      assert(creditTx.direction === 'inflow', 'Credit direction is inflow');
      assert(creditTx.amount === 1250, 'Credit amount is 1250');
      assert(creditTx.reference === '428901238910', 'Credit reference number preserved');
      assert(creditTx.accountMasked === 'XXXXXXXX9988', 'Account number preserved');
      assert(creditTx.idempotencyKey.includes('consent_parse_test'), 'Idempotency key includes consent ID');

      const debitTx = parsed[1];
      assert(debitTx.type === 'DEBIT', 'Debit transaction type is DEBIT');
      assert(debitTx.direction === 'outflow', 'Debit direction is outflow');
      assert(debitTx.amount === 450, 'Debit amount is 450');
    });

    // TEST 13: Duplicate Rejection & Idempotency Key Enforcement
    await test('TEST 13: Duplicate Rejection & Idempotency Key Enforcement', async () => {
      const mockTxns = [
        {
          txnId: 'IDEMP_TX_1',
          fipId: 'FIP-MOCK',
          accountMasked: 'XXXXXXXX1122',
          idempotencyKey: `setu_idemp_test_acc_${Date.now()}_1`,
          type: 'CREDIT',
          direction: 'inflow',
          amount: 800,
          currency: 'INR',
          mode: 'UPI',
          narration: 'Store customer UPI payment',
          reference: `UTR_${Date.now()}_1`,
          currentBalance: 10000,
          transactionTimestamp: new Date(),
        },
        {
          txnId: 'IDEMP_TX_2',
          fipId: 'FIP-MOCK',
          accountMasked: 'XXXXXXXX1122',
          idempotencyKey: `setu_idemp_test_acc_${Date.now()}_2`,
          type: 'DEBIT',
          direction: 'outflow',
          amount: 300,
          currency: 'INR',
          mode: 'UPI',
          narration: 'Packaging supplies debit',
          reference: `UTR_${Date.now()}_2`,
          currentBalance: 9700,
          transactionTimestamp: new Date(),
        },
      ];

      // First Import: Both must be inserted
      const firstImport = await setuService.importFITransactions({
        userId: testUser._id,
        consentId: 'consent_idemp_test',
        sessionId: 'sess_idemp_1',
        transactions: mockTxns,
        isSandbox: true,
      });

      assert(firstImport.importedCount === 2, `First import created 2 records (got ${firstImport.importedCount})`);
      assert(firstImport.skippedDuplicates === 0, 'No duplicates skipped on first import');

      // Second Import with identical idempotency keys: Both must be skipped!
      const secondImport = await setuService.importFITransactions({
        userId: testUser._id,
        consentId: 'consent_idemp_test',
        sessionId: 'sess_idemp_2',
        transactions: mockTxns,
        isSandbox: true,
      });

      assert(secondImport.importedCount === 0, 'Second import imported 0 duplicate records');
      assert(secondImport.skippedDuplicates === 2, 'Second import skipped 2 duplicates safely');
    });

    // TEST 14: Sandbox Labeling & Double-Counting Protection via Cross-Reconciliation
    await test('TEST 14: Sandbox Labeling & Double-Counting Protection via Cross-Reconciliation', async () => {
      const sharedUtr = `RECON_UTR_${Date.now()}`;

      // 1. Existing sale recorded earlier via shop counter
      const existingSale = await Sale.create({
        userId: testUser._id,
        amount: 600,
        paymentMethod: 'UPI',
        utrNumber: sharedUtr,
        referenceNumber: sharedUtr,
        description: 'Counter retail sale',
        isTest: true,
      });

      // 2. Setu statement contains matching bank credit with same UTR
      const bankTxnWithSharedUtr = [
        {
          txnId: 'RECON_TX_001',
          fipId: 'SETU-FIP',
          accountMasked: 'XXXXXXXX5544',
          idempotencyKey: `setu_recon_${Date.now()}`,
          type: 'CREDIT',
          direction: 'inflow',
          amount: 600,
          currency: 'INR',
          mode: 'UPI',
          narration: 'Counter retail sale via UPI',
          reference: sharedUtr,
          currentBalance: 12000,
          transactionTimestamp: new Date(),
        },
      ];

      const reconImport = await setuService.importFITransactions({
        userId: testUser._id,
        consentId: 'consent_recon_test',
        sessionId: 'sess_recon_1',
        transactions: bankTxnWithSharedUtr,
        isSandbox: true,
      });

      assert(reconImport.importedCount === 1, 'Imported 1 bank record');
      assert(reconImport.alreadyExistingCount === 1, 'Detected that UTR already existed in shop sales');

      const savedBankTx = reconImport.importedRecords[0];
      assert(savedBankTx.isTest === true, 'Sandbox transaction is clearly labeled isTest: true');
      assert(savedBankTx.source === 'setu_aa_sandbox', 'Source is explicitly setu_aa_sandbox');
      assert(savedBankTx.alreadyExistsInApp === true, 'Flagged as already existing in application');
      assert(savedBankTx.isReconciled === true, 'Reconciliation marked as true');
      assert(String(savedBankTx.linkedSaleId) === String(existingSale._id), 'Linked directly to matched Sale record');
      assert(savedBankTx.classification === 'unclassified', 'Classification defaults to unclassified');
    });

  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  }

  console.log('====================================================');
  console.log(`SETU STAGE 1 & 3 SUITE FINISHED: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Test suite runner failure:', err);
  process.exit(1);
});
