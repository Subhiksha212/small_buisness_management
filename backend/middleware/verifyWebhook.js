import { verifyAndParseWebhook } from '../services/paymentProviders/index.js';

/**
 * Strict Webhook Signature Verification Middleware
 * Validates cryptographic signatures for Razorpay, Cashfree, Paytm, and Sandbox.
 * STRICTLY NO DEV BYPASS: Requests without a valid signature are rejected with 4xx.
 */
export const verifyWebhookSignature = (req, res, next) => {
  try {
    const rawBody = req.rawBody || JSON.stringify(req.body);
    const body = req.body || {};
    const headers = req.headers || {};
    const queryProvider = req.params?.provider || req.query?.provider;

    const result = verifyAndParseWebhook({
      rawBody,
      body,
      headers,
      queryProvider,
    });

    if (!result.verified) {
      console.warn(`[SECURITY] Rejected Webhook: ${result.reason} (HTTP ${result.statusCode})`);
      return res.status(result.statusCode || 401).json({
        error: 'SignatureVerificationFailed',
        message: result.reason,
      });
    }

    // Attach verified and normalized data to request
    req.verifiedPaymentData = result.parsedData;
    req.paymentProvider = result.provider;

    next();
  } catch (error) {
    console.error('Error during webhook signature verification:', error.message);
    res.status(500).json({ error: 'WebhookVerificationError', message: 'Internal verification failure.' });
  }
};
