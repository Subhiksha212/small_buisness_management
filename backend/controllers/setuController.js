import setuService from '../services/setuService.js';
import BankTransaction from '../models/BankTransaction.js';

/**
 * GET /api/setu/config
 * Returns safe public configuration status of Setu AA Sandbox
 */
export const getSetuConfig = async (req, res) => {
  try {
    const config = setuService.getConfigStatus();
    res.status(200).json({
      success: true,
      config,
    });
  } catch (error) {
    console.error('Error fetching Setu config status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve Setu configuration status.',
    });
  }
};

/**
 * POST /api/setu/consents
 * Creates an Account Aggregator consent request via Setu API
 */
export const createConsent = async (req, res) => {
  try {
    const { customerPhone, customerVpa, redirectUrl } = req.body || {};

    const phoneToUse = customerPhone || req.user?.phone || '9999999999';

    const result = await setuService.createConsent({
      customerPhone: phoneToUse,
      customerVpa,
      redirectUrl,
    });

    if (!result.configured) {
      return res.status(503).json({
        success: false,
        configured: false,
        message: result.message,
      });
    }

    if (!result.success) {
      const httpStatus = result.statusCode === 401 ? 502 : (result.statusCode || 502);
      return res.status(httpStatus).json({
        success: false,
        error: result.error,
        message: result.message,
        details: result.details,
      });
    }

    res.status(201).json({
      success: true,
      consentId: result.consentId,
      status: result.status,
      consentUrl: result.consentUrl,
      redirectUrl: result.redirectUrl,
    });
  } catch (error) {
    console.error('Setu consent creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate Account Aggregator consent request.',
    });
  }
};

/**
 * GET /api/setu/consents/:id/status
 * Authoritative consent status check with upstream Setu API
 */
export const getConsentStatus = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !id.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Consent ID is required.',
      });
    }

    const result = await setuService.getConsentStatus(id.trim());

    if (!result.configured) {
      return res.status(503).json({
        success: false,
        configured: false,
        message: result.message,
      });
    }

    if (!result.success) {
      const httpStatus = result.statusCode === 401 ? 502 : (result.statusCode || 502);
      return res.status(httpStatus).json({
        success: false,
        error: result.error,
        message: result.message,
      });
    }

    res.status(200).json({
      success: true,
      consentId: result.consentId,
      status: result.status,
      verified: true,
      consentDetail: result.consentDetail,
      createdAt: result.createdAt,
    });
  } catch (error) {
    console.error('Setu consent status endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal error checking Setu consent status.',
    });
  }
};

/**
 * POST /api/setu/verify-callback
 * Validates Setu redirect query parameters against the authoritative upstream API
 */
export const verifyCallback = async (req, res) => {
  try {
    const { id, consentId, status, errorCode, errorMessage, resURI, txnid } = req.body;

    const resolvedId = consentId || id;

    if (!resolvedId || !String(resolvedId).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Consent ID or handle is required to verify callback.',
      });
    }

    // Secure logging without secrets
    console.log('[SETU CALLBACK VERIFICATION REQUEST]:', {
      timestamp: new Date().toISOString(),
      userId: req.user?._id,
      consentId: String(resolvedId).trim(),
      claimedStatus: status,
      errorCode: errorCode || null,
    });

    const verification = await setuService.verifyCallback({
      consentId: String(resolvedId).trim(),
      status,
      errorCode,
      errorMessage,
      resURI,
    });

    res.status(200).json({
      success: true,
      verification,
    });
  } catch (error) {
    console.error('Callback verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify Setu callback parameters.',
    });
  }
};

/**
 * GET /api/setu/callback
 * Direct browser redirect landing endpoint if Setu redirectUrl was set to Express backend.
 * Safely redirects the user to the React frontend at /setu-callback with all query params preserved.
 */
export const handleDirectCallback = (req, res) => {
  const queryParams = new URLSearchParams(req.query).toString();
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  console.log('[SETU DIRECT BACKEND REDIRECT RECEIVED]:', {
    timestamp: new Date().toISOString(),
    query: req.query,
  });

  // Redirect browser to React app /setu-callback preserving all parameters
  const redirectTarget = `${frontendUrl}/setu-callback${queryParams ? `?${queryParams}` : ''}`;
  res.redirect(302, redirectTarget);
};

/**
 * POST /api/setu/sessions
 * Create a data session for an approved consent
 */
export const createDataSession = async (req, res) => {
  try {
    const { consentId, dataRange, format = 'json' } = req.body || {};

    if (!consentId) {
      return res.status(400).json({
        success: false,
        error: 'MissingConsentId',
        message: 'consentId is required to create a data session.',
      });
    }

    const result = await setuService.createDataSession({
      consentId,
      dataRange,
      format,
    });

    if (!result.configured) {
      return res.status(503).json({
        success: false,
        configured: false,
        message: result.message,
      });
    }

    if (!result.success) {
      const httpStatus = result.statusCode === 401 ? 502 : (result.statusCode || 400);
      return res.status(httpStatus).json({
        success: false,
        error: result.error,
        message: result.message,
        details: result.details,
      });
    }

    res.status(201).json({
      success: true,
      sessionId: result.sessionId,
      status: result.status,
      consentId: result.consentId,
      dataRange: result.dataRange,
      format: result.format,
    });
  } catch (error) {
    console.error('Error creating Setu data session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create Setu Account Aggregator data session.',
    });
  }
};

/**
 * GET /api/setu/sessions/:id
 * Check data session status and retrieve session details
 */
export const getDataSession = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'MissingSessionId',
        message: 'Session ID is required.',
      });
    }

    const result = await setuService.getDataSession(id);

    if (!result.configured) {
      return res.status(503).json({
        success: false,
        configured: false,
        message: result.message,
      });
    }

    if (!result.success) {
      const httpStatus = result.statusCode === 401 ? 502 : (result.statusCode || 400);
      return res.status(httpStatus).json({
        success: false,
        error: result.error,
        message: result.message,
      });
    }

    res.status(200).json({
      success: true,
      session: {
        id: result.sessionId,
        status: result.status,
        consentId: result.consentId,
        dataRange: result.dataRange,
        format: result.format,
        hasData: Array.isArray(result.payload) && result.payload.length > 0,
      },
    });
  } catch (error) {
    console.error('Error fetching Setu data session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch Setu data session.',
    });
  }
};

/**
 * POST /api/setu/fetch-data
 * End-to-end endpoint: Creates session or uses existing sessionId,
 * polls until data is ready, parses transactions, and imports them.
 */
export const fetchAndImportData = async (req, res) => {
  try {
    const { consentId, sessionId, dataRange } = req.body || {};

    if (!consentId && !sessionId) {
      return res.status(400).json({
        success: false,
        error: 'MissingParameters',
        message: 'Either consentId or sessionId is required to fetch bank data.',
      });
    }

    const result = await setuService.fetchAndImportData({
      userId: req.user._id,
      consentId,
      sessionId,
      dataRange,
    });

    if (!result.configured && result.configured === false) {
      return res.status(503).json({
        success: false,
        configured: false,
        message: result.message,
      });
    }

    if (!result.success) {
      return res.status(result.statusCode || 400).json({
        success: false,
        error: result.error,
        message: result.message,
      });
    }

    res.status(200).json({
      success: true,
      status: result.status,
      sessionId: result.sessionId,
      consentId: result.consentId,
      totalFound: result.totalFound,
      importedCount: result.importedCount,
      skippedDuplicates: result.skippedDuplicates,
      alreadyExistingCount: result.alreadyExistingCount,
      records: result.records,
    });
  } catch (error) {
    console.error('Error in fetchAndImportData:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch and import Setu bank transactions.',
    });
  }
};

/**
 * GET /api/setu/transactions
 * Retrieve imported bank transactions for the authenticated user
 */
export const getBankTransactions = async (req, res) => {
  try {
    const { consentId, type, classification, startDate, endDate, limit = 50 } = req.query;

    const query = { userId: req.user._id };

    if (consentId) query.consentId = consentId;
    if (type && ['CREDIT', 'DEBIT'].includes(type.toUpperCase())) {
      query.type = type.toUpperCase();
    }
    if (classification) {
      query.classification = classification;
    }
    if (startDate || endDate) {
      query.transactionTimestamp = {};
      if (startDate) query.transactionTimestamp.$gte = new Date(startDate);
      if (endDate) query.transactionTimestamp.$lte = new Date(endDate);
    }

    const transactions = await BankTransaction.find(query)
      .sort({ transactionTimestamp: -1 })
      .limit(Number(limit) || 50)
      .lean();

    res.status(200).json({
      success: true,
      count: transactions.length,
      transactions,
    });
  } catch (error) {
    console.error('Error fetching bank transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve bank transactions.',
    });
  }
};

/**
 * PATCH /api/setu/transactions/:id/classify
 * Classify an imported bank transaction (e.g. as a business sale or expense)
 */
export const classifyBankTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { classification } = req.body;

    const validClassifications = ['unclassified', 'business_sale', 'business_expense', 'personal_transfer'];
    if (!validClassifications.includes(classification)) {
      return res.status(400).json({
        success: false,
        message: `Invalid classification. Must be one of: ${validClassifications.join(', ')}`,
      });
    }

    const bankTx = await BankTransaction.findOne({ _id: id, userId: req.user._id });
    if (!bankTx) {
      return res.status(404).json({
        success: false,
        message: 'Bank transaction not found.',
      });
    }

    bankTx.classification = classification;
    await bankTx.save();

    res.status(200).json({
      success: true,
      message: `Transaction classified as ${classification}.`,
      transaction: bankTx,
    });
  } catch (error) {
    console.error('Error classifying bank transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to classify bank transaction.',
    });
  }
};

