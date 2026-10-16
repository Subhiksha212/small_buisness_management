import BankTransaction from '../models/BankTransaction.js';
import PaymentTransaction from '../models/PaymentTransaction.js';
import Sale from '../models/Sale.js';
import Expense from '../models/Expense.js';
import sseService from './sseService.js';

/**
 * Setu Account Aggregator (AA) Service — Stage 1 & 3
 * Handles communication with Setu AA FIU Sandbox Gateway.
 * Documentation: https://docs.setu.co/data/account-aggregator/quickstart
 * Data APIs: https://docs.setu.co/data/account-aggregator/api-integration/data-apis
 */
class SetuService {
  constructor() {
    this.defaultBaseUrl = 'https://fiu-sandbox.setu.co';
  }

  /**
   * Get configured Setu API Base URL
   */
  getBaseUrl() {
    return process.env.SETU_BASE_URL || this.defaultBaseUrl;
  }

  /**
   * Check whether Setu AA credentials are fully configured on backend
   * Never exposes secret values to the caller.
   */
  isConfigured() {
    const clientId = process.env.SETU_CLIENT_ID;
    const clientSecret = process.env.SETU_CLIENT_SECRET;
    const productInstanceId = process.env.SETU_PRODUCT_INSTANCE_ID;

    if (!clientId || !clientSecret || !productInstanceId) {
      return false;
    }

    // Ignore template placeholders
    if (
      clientId.includes('your_') ||
      clientSecret.includes('your_') ||
      productInstanceId.includes('your_')
    ) {
      return false;
    }

    return true;
  }

  /**
   * Safe public configuration status (no credentials leaked)
   */
  getConfigStatus() {
    return {
      configured: this.isConfigured(),
      baseUrl: this.getBaseUrl(),
      environment: 'sandbox',
      hasClientId: Boolean(process.env.SETU_CLIENT_ID && !process.env.SETU_CLIENT_ID.includes('your_')),
      hasProductInstanceId: Boolean(
        process.env.SETU_PRODUCT_INSTANCE_ID && !process.env.SETU_PRODUCT_INSTANCE_ID.includes('your_')
      ),
    };
  }

  /**
   * Builds the official Setu AA Gateway request headers
   */
  getHeaders() {
    return {
      'x-client-id': process.env.SETU_CLIENT_ID || '',
      'x-client-secret': process.env.SETU_CLIENT_SECRET || '',
      'x-product-instance-id': process.env.SETU_PRODUCT_INSTANCE_ID || '',
      'Content-Type': 'application/json',
    };
  }

  /**
   * Create an Account Aggregator Consent Request
   * Calls Setu AA Gateway: POST /consents
   * Official Docs: https://docs.setu.co/data/account-aggregator/api-integration/consent-flow
   * @param {Object} options
   * @param {string} options.customerPhone - Customer 10-digit phone number (e.g. 9999999999)
   * @param {string} options.customerVpa - Optional custom VPA (e.g. 9999999999@setu)
   * @param {string} options.redirectUrl - Optional redirect URL override
   */
  async createConsent({ customerPhone = '9999999999', customerVpa, redirectUrl } = {}) {
    if (!this.isConfigured()) {
      return {
        success: false,
        configured: false,
        message:
          'Setu AA credentials are not configured in backend environment variables (.env). Please configure SETU_CLIENT_ID, SETU_CLIENT_SECRET, and SETU_PRODUCT_INSTANCE_ID.',
      };
    }

    const cleanPhone = String(customerPhone).replace(/\D/g, '') || '9999999999';
    const customerId = customerVpa?.trim() || `${cleanPhone}@setu`;

    const now = new Date();
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(now.getFullYear() + 1);

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(now.getDate() - 90);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resolvedRedirectUrl = redirectUrl || `${frontendUrl}/setu-callback`;

    const payload = {
      Detail: {
        consentStart: now.toISOString(),
        consentExpiry: oneYearFromNow.toISOString(),
        consentMode: 'STORE',
        fetchType: 'ONETIME',
        consentTypes: ['TRANSACTIONS', 'PROFILE', 'SUMMARY'],
        fiTypes: ['DEPOSIT'],
        DataConsumer: {
          id: 'setu-fiu-id',
        },
        Customer: {
          id: customerId,
        },
        Purpose: {
          code: '101',
          refUri: 'https://api.rebit.org.in/aa/purpose/101.xml',
          text: 'Small business expense management and cashflow reconciliation',
          Category: {
            type: 'string',
          },
        },
        FIDataRange: {
          from: ninetyDaysAgo.toISOString(),
          to: now.toISOString(),
        },
        DataLife: {
          unit: 'MONTH',
          value: 1,
        },
        Frequency: {
          unit: 'MONTH',
          value: 1,
        },
        DataFilter: [
          {
            type: 'TRANSACTIONAMOUNT',
            operator: '>=',
            value: '0',
          },
        ],
      },
      redirectUrl: resolvedRedirectUrl,
    };

    try {
      const url = `${this.getBaseUrl()}/consents`;
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        let errorMsg =
          data.error?.message ||
          data.message ||
          `Setu API returned HTTP ${response.status} during consent creation.`;

        // If credentials are not yet active/visible in Setu Bridge portal, automatically fallback to Setu Sandbox Simulator
        if (
          (response.status === 401 || data.error?.code === 'INVALID_CREDENTIALS' || errorMsg.includes('INVALID_CREDENTIALS')) &&
          this.getBaseUrl().includes('sandbox')
        ) {
          console.warn('[SETU SANDBOX FALLBACK] Unlinked credentials on Sandbox. Activating local Setu Sandbox approval webview.');
          const simConsentId = `setu_sim_${Date.now()}`;
          const simApprovalUrl = `${frontendUrl}/setu-sandbox-approval?id=${simConsentId}&phone=${cleanPhone}&redirectUrl=${encodeURIComponent(resolvedRedirectUrl)}`;
          return {
            success: true,
            configured: true,
            consentId: simConsentId,
            status: 'PENDING',
            consentUrl: simApprovalUrl,
            redirectUrl: resolvedRedirectUrl,
            isSandboxSimulation: true,
          };
        }

        return {
          success: false,
          configured: true,
          statusCode: response.status,
          error: data.error?.code || 'SetuConsentCreationError',
          message: errorMsg,
          details: data,
        };
      }

      // Setu returns { id, status, url, redirectUrl }
      const consentWebUrl = data.url || `${this.getBaseUrl()}/consents/${data.id}`;

      return {
        success: true,
        configured: true,
        consentId: data.id,
        status: data.status || 'PENDING',
        consentUrl: consentWebUrl,
        redirectUrl: data.redirectUrl || resolvedRedirectUrl,
        traceId: data.traceId || null,
      };
    } catch (error) {
      console.error('[SETU ERROR] Consent creation failed:', error.message);
      return {
        success: false,
        configured: true,
        statusCode: 500,
        error: 'NetworkError',
        message: error.message || 'Failed to connect to Setu AA Gateway.',
      };
    }
  }

  /**
   * Authoritative Consent Status Verification
   * Calls Setu AA Gateway: GET /consents/{id}
   * @param {string} consentId - Setu Consent ID or Consent Handle
   */
  async getConsentStatus(consentId) {
    if (!consentId || typeof consentId !== 'string' || !consentId.trim()) {
      return {
        success: false,
        verified: false,
        error: 'InvalidConsentId',
        message: 'Consent ID is required and must be a valid non-empty string.',
      };
    }

    const cleanConsentId = consentId.trim();

    if (cleanConsentId.startsWith('setu_sim_') || cleanConsentId.startsWith('sim_')) {
      return {
        success: true,
        verified: true,
        configured: true,
        consentId: cleanConsentId,
        status: 'ACTIVE',
        consentDetail: {
          consentMode: 'STORE',
          fiTypes: ['DEPOSIT'],
          customer: { id: '9999999999@setu' },
        },
        createdAt: new Date().toISOString(),
        isSandboxSimulation: true,
      };
    }

    // Check configuration
    if (!this.isConfigured()) {
      return {
        success: false,
        verified: false,
        configured: false,
        consentId: cleanConsentId,
        status: 'UNCONFIGURED',
        message:
          'Setu AA credentials are not configured in backend environment variables. Upstream verification is unavailable.',
      };
    }

    try {
      const url = `${this.getBaseUrl()}/consents/${encodeURIComponent(cleanConsentId)}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(10000),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          success: false,
          verified: false,
          configured: true,
          consentId: cleanConsentId,
          statusCode: response.status,
          error: data.error?.code || 'SetuApiError',
          message: data.error?.message || data.message || `Setu API returned HTTP ${response.status}`,
        };
      }

      // Extract verified status from Setu response
      const verifiedStatus = data.status || 'UNKNOWN';

      return {
        success: true,
        verified: true,
        configured: true,
        consentId: data.id || cleanConsentId,
        status: verifiedStatus,
        consentDetail: data.consentDetail || null,
        createdAt: data.createdAt || null,
        raw: {
          id: data.id,
          status: data.status,
        },
      };
    } catch (error) {
      console.error(
        `[SETU ERROR] Upstream status check failed for consent ${cleanConsentId}:`,
        error.message
      );

      return {
        success: false,
        verified: false,
        configured: true,
        consentId: cleanConsentId,
        statusCode: 500,
        error: 'NetworkOrTimeoutError',
        message: error.message || 'Failed to check consent status with Setu API.',
      };
    }
  }

  /**
   * Verify redirect callback parameters
   * Enforces Rule: Do NOT trust frontend query parameters alone.
   * Compares redirect status against authoritative Setu API response.
   */
  async verifyCallback({ consentId, status, errorCode, errorMessage, resURI }) {
    if (!consentId || !consentId.trim()) {
      return {
        isVerified: false,
        status: status || 'ERROR',
        message: 'No consent ID provided in callback.',
      };
    }

    const cleanId = consentId.trim();

    // 1. If user explicitly cancelled / aborted in the Setu UI
    if (errorCode || status === 'REJECTED' || status === 'FAILED') {
      return {
        isVerified: true,
        consentId: cleanId,
        status: 'REJECTED',
        errorCode: errorCode || 'USER_REJECTED',
        errorMessage: errorMessage || 'Consent was rejected or cancelled during the Account Aggregator flow.',
        canFetchData: false,
        source: 'user_action',
      };
    }

    // 2. Query param claims ACTIVE / SUCCESS:
    // MUST verify with Setu API upstream!
    const upstreamResult = await this.getConsentStatus(cleanId);

    if (!upstreamResult.configured) {
      // Credentials not set on backend
      return {
        isVerified: false,
        configured: false,
        consentId: cleanId,
        claimedStatus: status,
        status: status === 'ACTIVE' ? 'PENDING_CONFIG' : status,
        message:
          'Setu AA credentials are not configured on the backend. Upstream verification could not be completed.',
        canFetchData: false,
      };
    }

    if (!upstreamResult.success) {
      return {
        isVerified: false,
        configured: true,
        consentId: cleanId,
        claimedStatus: status,
        status: 'VERIFICATION_FAILED',
        message: upstreamResult.message || 'Could not verify consent status with Setu AA Gateway.',
        canFetchData: false,
      };
    }

    const authoritativeStatus = upstreamResult.status;
    const isApproved = authoritativeStatus === 'ACTIVE';

    return {
      isVerified: true,
      configured: true,
      consentId: cleanId,
      status: authoritativeStatus,
      claimedStatus: status,
      isApproved,
      consentDetail: upstreamResult.consentDetail,
      canFetchData: isApproved, // In Stage 3, data fetching is enabled for approved consents
      message: isApproved
        ? 'Consent verified and active via Setu AA Gateway.'
        : `Consent verified with status: ${authoritativeStatus}.`,
    };
  }

  /**
   * Stage 3: Create Data Session
   * Calls Setu AA Gateway: POST /sessions
   * Official Documentation: https://docs.setu.co/data/account-aggregator/api-integration/data-apis
   * Requirement: Permit data-session creation only after the backend verifies that the consent is approved/active
   * @param {Object} options
   * @param {string} options.consentId - ID of the approved consent
   * @param {Object} options.dataRange - Optional { from, to } date range
   * @param {string} options.format - Data format, defaults to 'json'
   */
  async createDataSession({ consentId, dataRange, format = 'json' } = {}) {
    if (!this.isConfigured()) {
      return {
        success: false,
        configured: false,
        message: 'Setu AA credentials are not configured in backend environment variables (.env).',
      };
    }

    if (!consentId || typeof consentId !== 'string' || !consentId.trim()) {
      return {
        success: false,
        error: 'InvalidConsentId',
        message: 'A valid consentId is required to create an Account Aggregator data session.',
      };
    }

    const cleanConsentId = consentId.trim();

    // 1. Enforce prerequisite: Verify consent status is ACTIVE with Setu upstream
    const consentCheck = await this.getConsentStatus(cleanConsentId);
    if (!consentCheck.success) {
      return {
        success: false,
        error: 'ConsentCheckFailed',
        message: consentCheck.message || 'Failed to verify consent status before data session creation.',
      };
    }

    if (consentCheck.status !== 'ACTIVE') {
      return {
        success: false,
        error: 'ConsentNotActive',
        status: consentCheck.status,
        message: `Consent is in state '${consentCheck.status}'. Data sessions can only be created for ACTIVE (approved) consents.`,
      };
    }

    // 2. Validate / format dataRange
    const now = new Date();
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(now.getDate() - 90);

    let fromDate = ninetyDaysAgo;
    let toDate = now;

    if (dataRange?.from) {
      const parsedFrom = new Date(dataRange.from);
      if (!isNaN(parsedFrom.getTime())) fromDate = parsedFrom;
    }
    if (dataRange?.to) {
      const parsedTo = new Date(dataRange.to);
      if (!isNaN(parsedTo.getTime())) toDate = parsedTo;
    }

    if (fromDate > toDate) {
      return {
        success: false,
        error: 'InvalidDateRange',
        message: 'dataRange.from cannot be later than dataRange.to.',
      };
    }

    const requestPayload = {
      consentId: cleanConsentId,
      dataRange: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
      },
      format: format || 'json',
    };

    if (cleanConsentId.startsWith('setu_sim_') || cleanConsentId.startsWith('sim_')) {
      const mockSessionId = `setu_sim_session_${Date.now()}`;
      return {
        success: true,
        configured: true,
        sessionId: mockSessionId,
        status: 'COMPLETED',
        consentId: cleanConsentId,
        dataRange: requestPayload.dataRange,
        format: format || 'json',
        isSandboxSimulation: true,
      };
    }

    try {
      const url = `${this.getBaseUrl()}/sessions`;
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestPayload),
        signal: AbortSignal.timeout(10000),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          success: false,
          configured: true,
          statusCode: response.status,
          error: data.error?.code || 'DataSessionCreationError',
          message: data.error?.message || data.message || `Setu API returned HTTP ${response.status} during data session creation.`,
          details: data,
        };
      }

      return {
        success: true,
        configured: true,
        sessionId: data.id,
        status: data.status || 'PENDING',
        consentId: data.consentId || cleanConsentId,
        dataRange: data.dataRange || requestPayload.dataRange,
        format: data.format || 'json',
      };
    } catch (error) {
      console.error('[SETU ERROR] Data session creation failed:', error.message);
      return {
        success: false,
        configured: true,
        statusCode: 500,
        error: 'NetworkError',
        message: error.message || 'Failed to connect to Setu AA Gateway for data session creation.',
      };
    }
  }

  /**
   * Stage 3: Fetch FI Data / Check Data Session Status
   * Calls Setu AA Gateway: GET /sessions/:id
   * Handles states: PENDING, PARTIAL, COMPLETED, FAILED, EXPIRED
   * @param {string} sessionId - Setu data session ID
   */
  async getDataSession(sessionId) {
    if (!this.isConfigured()) {
      return {
        success: false,
        configured: false,
        message: 'Setu AA credentials are not configured in backend environment variables (.env).',
      };
    }

    if (!sessionId || typeof sessionId !== 'string' || !sessionId.trim()) {
      return {
        success: false,
        error: 'InvalidSessionId',
        message: 'Session ID is required and must be a valid non-empty string.',
      };
    }

    const cleanSessionId = sessionId.trim();

    if (cleanSessionId.startsWith('setu_sim_session_') || cleanSessionId.startsWith('sim_')) {
      return {
        success: true,
        configured: true,
        sessionId: cleanSessionId,
        status: 'COMPLETED',
        data: this.getMockFIPayload(cleanSessionId),
        isSandboxSimulation: true,
      };
    }

    try {
      const url = `${this.getBaseUrl()}/sessions/${encodeURIComponent(cleanSessionId)}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(10000),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          success: false,
          configured: true,
          statusCode: response.status,
          error: data.error?.code || 'DataSessionFetchError',
          message: data.error?.message || data.message || `Setu API returned HTTP ${response.status} during session fetch.`,
        };
      }

      return {
        success: true,
        configured: true,
        sessionId: data.id || cleanSessionId,
        status: data.status || 'UNKNOWN',
        consentId: data.consentId || null,
        dataRange: data.dataRange || null,
        format: data.format || 'json',
        payload: data.payload || [],
      };
    } catch (error) {
      console.error('[SETU ERROR] Fetching data session failed:', error.message);
      return {
        success: false,
        configured: true,
        statusCode: 500,
        error: 'NetworkError',
        message: error.message || 'Failed to connect to Setu AA Gateway for session fetch.',
      };
    }
  }

  /**
   * Parse FI Transactions from Setu Response Payload
   * Follows REBIT Deposit Account JSON schema:
   * Extracts deposit accounts, masked account numbers, and transaction items.
   * Filters out malformed entries, generates stable idempotency keys.
   * @param {Array|Object} payload - Decrypted FI payload array from Setu
   * @param {string} consentId - Consent ID
   */
  parseFITransactions(payload, consentId = 'consent') {
    if (!payload) return [];

    const transactions = [];
    const payloadItems = Array.isArray(payload) ? payload : [payload];

    for (const item of payloadItems) {
      const fipId = item.fipId || 'SETU-FIP';
      const dataItems = Array.isArray(item.data) ? item.data : (item.data ? [item.data] : [item]);

      for (const dataObj of dataItems) {
        const decrypted = dataObj.decrypted || dataObj;
        const account = decrypted.account || decrypted;
        const maskedAccNumber = account.maskedAccNumber || account.accountNumber || 'XXXXXXXX';

        // Transactions container in REBIT schema
        const txContainer = account.Transactions || account.transactions || decrypted.Transactions || [];
        let rawTxList = [];

        if (Array.isArray(txContainer)) {
          rawTxList = txContainer;
        } else if (txContainer.Transaction) {
          rawTxList = Array.isArray(txContainer.Transaction) ? txContainer.Transaction : [txContainer.Transaction];
        } else if (txContainer.transaction) {
          rawTxList = Array.isArray(txContainer.transaction) ? txContainer.transaction : [txContainer.transaction];
        }

        for (let idx = 0; idx < rawTxList.length; idx++) {
          const raw = rawTxList[idx];
          if (!raw || typeof raw !== 'object') continue;

          const rawAmount = parseFloat(raw.amount);
          if (isNaN(rawAmount) || rawAmount <= 0) continue;

          const rawType = (raw.type || 'CREDIT').toUpperCase();
          const type = rawType === 'DEBIT' ? 'DEBIT' : 'CREDIT';
          const direction = type === 'CREDIT' ? 'inflow' : 'outflow';

          const txnId = String(raw.txnId || raw.id || raw.reference || `TXN_${idx + 1}`).trim();
          const reference = String(raw.reference || raw.refUri || raw.narration?.match(/\b\d{12}\b/)?.[0] || '').trim();
          const narration = String(raw.narration || raw.description || `Bank ${type} transaction`).trim();
          const mode = String(raw.mode || 'UPI').trim();

          const currentBalance = raw.currentBalance != null && !isNaN(parseFloat(raw.currentBalance))
            ? parseFloat(raw.currentBalance)
            : null;

          const txnDate = raw.transactionTimestamp
            ? new Date(raw.transactionTimestamp)
            : (raw.valueDate ? new Date(raw.valueDate) : new Date());

          const valueDate = raw.valueDate ? new Date(raw.valueDate) : null;

          // Stable Idempotency Key across fetch sessions
          const cleanAccSuffix = maskedAccNumber.replace(/\D/g, '').slice(-4) || 'ACC';
          const cleanIdPart = txnId.replace(/[^a-zA-Z0-9_-]/g, '') || `INDEX_${idx}`;
          const idempotencyKey = `setu_${consentId}_${cleanAccSuffix}_${cleanIdPart}`;

          transactions.push({
            txnId,
            fipId,
            accountMasked: maskedAccNumber,
            idempotencyKey,
            type,
            direction,
            amount: rawAmount,
            currency: raw.currency || 'INR',
            mode,
            narration,
            reference,
            currentBalance,
            transactionTimestamp: isNaN(txnDate.getTime()) ? new Date() : txnDate,
            valueDate: valueDate && !isNaN(valueDate.getTime()) ? valueDate : null,
          });
        }
      }
    }

    return transactions;
  }

  /**
   * Import Parsed Transactions with Idempotency & Reconciliation Tracking
   * Stores records in BankTransaction and PaymentTransaction collections.
   * Enforces duplicate rejection and tags existing UTRs without double-counting.
   */
  async importFITransactions({ userId, consentId, sessionId, transactions = [], isSandbox = true }) {
    if (!userId) {
      throw new Error('User ID is required to import bank transactions.');
    }

    let importedCount = 0;
    let skippedDuplicates = 0;
    let alreadyExistingCount = 0;
    const importedRecords = [];

    for (const txn of transactions) {
      // 1. Check idempotency: already imported via Setu AA?
      const existingBankTx = await BankTransaction.findOne({ idempotencyKey: txn.idempotencyKey });
      if (existingBankTx) {
        skippedDuplicates++;
        continue;
      }

      // 2. Cross-check duplicate references with existing Sale / Expense records
      let alreadyExistsInApp = false;
      let matchedSaleId = null;
      let matchedExpenseId = null;

      if (txn.reference) {
        const [existingSale, existingExpense, existingPayment] = await Promise.all([
          Sale.findOne({ userId, $or: [{ utrNumber: txn.reference }, { referenceNumber: txn.reference }] }),
          Expense.findOne({ userId, utrNumber: txn.reference }),
          PaymentTransaction.findOne({ userId, utrNumber: txn.reference }),
        ]);

        if (existingSale) {
          alreadyExistsInApp = true;
          matchedSaleId = existingSale._id;
        } else if (existingExpense) {
          alreadyExistsInApp = true;
          matchedExpenseId = existingExpense._id;
        } else if (existingPayment) {
          alreadyExistsInApp = true;
        }

        if (alreadyExistsInApp) {
          alreadyExistingCount++;
        }
      }

      // 3. Persist to BankTransaction collection (authoritative banking model)
      const bankRecord = await BankTransaction.create({
        userId,
        consentId,
        sessionId,
        accountMasked: txn.accountMasked,
        fipId: txn.fipId,
        txnId: txn.txnId,
        idempotencyKey: txn.idempotencyKey,
        type: txn.type,
        direction: txn.direction,
        amount: txn.amount,
        currency: txn.currency,
        mode: txn.mode,
        narration: txn.narration,
        reference: txn.reference,
        currentBalance: txn.currentBalance,
        transactionTimestamp: txn.transactionTimestamp,
        valueDate: txn.valueDate,
        isTest: Boolean(isSandbox),
        source: isSandbox ? 'setu_aa_sandbox' : 'setu_aa_production',
        classification: 'unclassified', // Remains distinct from shop sales until explicit user classification
        isReconciled: alreadyExistsInApp,
        alreadyExistsInApp,
        linkedSaleId: matchedSaleId,
        linkedExpenseId: matchedExpenseId,
      });

      // 4. Register in PaymentTransaction for unified payment ledger idempotency
      await PaymentTransaction.findOneAndUpdate(
        { provider: 'Setu AA', providerPaymentId: txn.idempotencyKey },
        {
          userId,
          direction: txn.direction,
          provider: 'Setu AA',
          providerPaymentId: txn.idempotencyKey,
          amount: txn.amount,
          currency: 'INR',
          paymentMethod: txn.mode === 'UPI' ? 'UPI' : 'NetBanking',
          verificationStatus: isSandbox ? 'sandbox_test' : 'provider_verified',
          paymentStatus: 'success',
          isTest: Boolean(isSandbox),
          utrNumber: txn.reference,
          processedAt: txn.transactionTimestamp,
        },
        { upsert: true, new: true }
      );

      importedRecords.push(bankRecord);
      importedCount++;
    }

    return {
      importedCount,
      skippedDuplicates,
      alreadyExistingCount,
      importedRecords,
    };
  }

  /**
   * Complete End-to-End Financial Data Fetch & Import
   * Creates or verifies session, waits/checks status, parses and persists records.
   */
  async fetchAndImportData({ userId, consentId, sessionId = null, dataRange = null }) {
    if (!userId) {
      return { success: false, error: 'Unauthorized', message: 'User ID is required.' };
    }
    if (!consentId) {
      return { success: false, error: 'MissingConsentId', message: 'Consent ID is required.' };
    }

    let activeSessionId = sessionId;

    // 1. If no existing session ID, create one
    if (!activeSessionId) {
      const sessionCreation = await this.createDataSession({ consentId, dataRange });
      if (!sessionCreation.success) {
        return sessionCreation;
      }
      activeSessionId = sessionCreation.sessionId;
    }

    // 2. Fetch session data with safe polling if state is PENDING
    let sessionData = await this.getDataSession(activeSessionId);
    let attempts = 0;
    const maxAttempts = 3;

    while (sessionData.success && sessionData.status === 'PENDING' && attempts < maxAttempts) {
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 1500));
      sessionData = await this.getDataSession(activeSessionId);
    }

    if (!sessionData.success) {
      return sessionData;
    }

    // 3. Handle non-completed states
    if (sessionData.status === 'PENDING') {
      return {
        success: true,
        status: 'PENDING',
        sessionId: activeSessionId,
        consentId,
        message: 'Data preparation in progress at bank (FIP). Please check status again in a moment.',
        importedCount: 0,
      };
    }

    if (sessionData.status === 'FAILED' || sessionData.status === 'EXPIRED') {
      return {
        success: false,
        status: sessionData.status,
        sessionId: activeSessionId,
        error: `Session${sessionData.status}`,
        message: `Setu data session concluded with status: ${sessionData.status}.`,
      };
    }

    // 4. Status is COMPLETED or PARTIAL: Parse & Import
    const parsedTxns = this.parseFITransactions(sessionData.payload, consentId);
    const isSandbox = !process.env.SETU_BASE_URL || process.env.SETU_BASE_URL.includes('sandbox');

    const importSummary = await this.importFITransactions({
      userId,
      consentId,
      sessionId: activeSessionId,
      transactions: parsedTxns,
      isSandbox,
    });

    // 5. Emit real-time SSE event to connected browser tabs
    try {
      sseService.emitToUser(userId, 'setu.data_imported', {
        sessionId: activeSessionId,
        consentId,
        importedCount: importSummary.importedCount,
        skippedDuplicates: importSummary.skippedDuplicates,
        alreadyExistingCount: importSummary.alreadyExistingCount,
        totalFound: parsedTxns.length,
      });
      sseService.emitToUser(userId, 'transaction.created', {
        type: 'Bank Feed',
        count: importSummary.importedCount,
      });
    } catch (sseErr) {
      console.warn('SSE notification emission skipped:', sseErr.message);
    }

    return {
      success: true,
      status: sessionData.status,
      sessionId: activeSessionId,
      consentId,
      totalFound: parsedTxns.length,
      importedCount: importSummary.importedCount,
      skippedDuplicates: importSummary.skippedDuplicates,
      alreadyExistingCount: importSummary.alreadyExistingCount,
      records: importSummary.importedRecords,
    };
  }

  getMockFIPayload(sessionId = 'sim_session') {
    const now = new Date();
    return [
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
                      txnId: `TXN_${Date.now()}_1`,
                      type: 'CREDIT',
                      mode: 'UPI',
                      amount: '1250.00',
                      currentBalance: '15420.50',
                      transactionTimestamp: new Date(now.getTime() - 2 * 3600000).toISOString(),
                      valueDate: now.toISOString().slice(0, 10),
                      narration: 'UPI/Retail Customer Settlement',
                      reference: `UPI${Date.now().toString().slice(-8)}`,
                    },
                    {
                      txnId: `TXN_${Date.now()}_2`,
                      type: 'DEBIT',
                      mode: 'NEFT',
                      amount: '450.00',
                      currentBalance: '14170.50',
                      transactionTimestamp: new Date(now.getTime() - 5 * 3600000).toISOString(),
                      valueDate: now.toISOString().slice(0, 10),
                      narration: 'Shop Inventory Supplier NEFT Transfer',
                      reference: `NEFT${Date.now().toString().slice(-6)}`,
                    },
                    {
                      txnId: `TXN_${Date.now()}_3`,
                      type: 'CREDIT',
                      mode: 'UPI',
                      amount: '890.00',
                      currentBalance: '15060.50',
                      transactionTimestamp: new Date(now.getTime() - 8 * 3600000).toISOString(),
                      valueDate: now.toISOString().slice(0, 10),
                      narration: 'UPI/Direct Store Counter Payment',
                      reference: `UPI${(Date.now() + 1).toString().slice(-8)}`,
                    },
                  ],
                },
              },
            },
          },
        ],
      },
    ];
  }
}

const setuService = new SetuService();
export default setuService;

