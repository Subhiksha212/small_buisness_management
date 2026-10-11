import { verifyRazorpayWebhook, parseRazorpayPayload } from './razorpay.js';
import { verifyCashfreeWebhook, parseCashfreePayload } from './cashfree.js';
import { verifyPaytmWebhook, parsePaytmPayload } from './paytm.js';
import { verifySandboxWebhook, parseSandboxPayload } from './sandbox.js';
import { verifyPhonePeWebhook, parsePhonePePayload } from './phonepe.js';
import { verifyGPayWebhook, parseGPayPayload } from './gpay.js';
import { verifyBankFeedWebhook, parseBankFeedPayload } from './bankFeed.js';

/**
 * Detects and verifies an incoming webhook using the appropriate provider adapter.
 * Rejects with { verified: false, reason: '...' } if verification fails.
 * STRICTLY NO DEV BYPASS: development / sandbox requests MUST be verified with sandbox secret.
 */
export const verifyAndParseWebhook = ({ rawBody, body, headers, queryProvider, webhookSecret }) => {
  if (!rawBody) {
    return {
      verified: false,
      statusCode: 400,
      reason: 'Missing raw request body required for cryptographic signature verification.',
    };
  }

  // 1. Detect Provider based on signature headers or explicit provider param
  let provider = (queryProvider || '').toLowerCase();
  if (headers['x-verify']) {
    provider = 'phonepe';
  } else if (headers['x-gpay-signature'] || headers['x-goog-signature']) {
    provider = 'gpay';
  } else if (headers['x-bank-signature']) {
    provider = 'bankfeed';
  } else if (headers['x-razorpay-signature']) {
    provider = 'razorpay';
  } else if (headers['x-webhook-signature'] && headers['x-webhook-timestamp']) {
    provider = 'cashfree';
  } else if (headers['x-paytm-signature'] || headers['checksumhash']) {
    provider = 'paytm';
  } else if (headers['x-sandbox-signature']) {
    provider = 'sandbox';
  }

  const configuredSecret = webhookSecret || process.env.PAYMENT_WEBHOOK_SECRET;

  switch (provider) {
    case 'razorpay': {
      const signature = headers['x-razorpay-signature'];
      if (!signature) {
        return { verified: false, statusCode: 400, reason: 'Missing x-razorpay-signature header.' };
      }
      if (!configuredSecret) {
        return { verified: false, statusCode: 500, reason: 'Razorpay webhook secret not configured on server.' };
      }

      const isValid = verifyRazorpayWebhook(rawBody, signature, configuredSecret);
      if (!isValid) {
        return { verified: false, statusCode: 401, reason: 'Invalid Razorpay webhook signature.' };
      }

      return {
        verified: true,
        provider: 'Razorpay',
        parsedData: parseRazorpayPayload(body),
      };
    }

    case 'cashfree': {
      const signature = headers['x-webhook-signature'];
      const timestamp = headers['x-webhook-timestamp'];
      if (!signature || !timestamp) {
        return { verified: false, statusCode: 400, reason: 'Missing Cashfree signature or timestamp headers.' };
      }
      if (!configuredSecret) {
        return { verified: false, statusCode: 500, reason: 'Cashfree webhook secret not configured on server.' };
      }

      const isValid = verifyCashfreeWebhook(rawBody, signature, timestamp, configuredSecret);
      if (!isValid) {
        return { verified: false, statusCode: 401, reason: 'Invalid Cashfree webhook signature.' };
      }

      return {
        verified: true,
        provider: 'Cashfree',
        parsedData: parseCashfreePayload(body),
      };
    }

    case 'paytm': {
      const signature = headers['x-paytm-signature'] || headers['checksumhash'] || body.CHECKSUMHASH;
      if (!signature) {
        return { verified: false, statusCode: 400, reason: 'Missing Paytm checksum signature.' };
      }
      if (!configuredSecret) {
        return { verified: false, statusCode: 500, reason: 'Paytm merchant secret not configured on server.' };
      }

      const isValid = verifyPaytmWebhook(rawBody, signature, configuredSecret);
      if (!isValid) {
        return { verified: false, statusCode: 401, reason: 'Invalid Paytm webhook signature.' };
      }

      return {
        verified: true,
        provider: 'Paytm',
        parsedData: parsePaytmPayload(body),
      };
    }

    case 'sandbox': {
      // Sandbox is only allowed in sandbox/development mode
      const isSandboxAllowed = process.env.PAYMENT_ENV === 'sandbox' || process.env.NODE_ENV !== 'production';
      if (!isSandboxAllowed) {
        return { verified: false, statusCode: 403, reason: 'Sandbox webhook disabled in production environment.' };
      }

      const signature = headers['x-sandbox-signature'];
      if (!signature) {
        return { verified: false, statusCode: 400, reason: 'Missing x-sandbox-signature header.' };
      }

      const sandboxSecret = configuredSecret || 'sandbox_secret_key_98765';
      const isValid = verifySandboxWebhook(rawBody, signature, sandboxSecret);
      if (!isValid) {
        return { verified: false, statusCode: 401, reason: 'Invalid Sandbox webhook signature.' };
      }

      return {
        verified: true,
        provider: 'Sandbox',
        parsedData: parseSandboxPayload(body),
      };
    }

    case 'phonepe': {
      const xVerify = headers['x-verify'];
      if (!xVerify) {
        return { verified: false, statusCode: 400, reason: 'Missing X-VERIFY checksum header for PhonePe.' };
      }
      const saltKey = process.env.PHONEPE_SALT_KEY || configuredSecret;
      const saltIndex = process.env.PHONEPE_SALT_INDEX || '1';
      if (!saltKey) {
        return { verified: false, statusCode: 500, reason: 'PhonePe Salt Key not configured on server.' };
      }

      const isValid = verifyPhonePeWebhook(rawBody, body, xVerify, saltKey, saltIndex);
      if (!isValid) {
        return { verified: false, statusCode: 401, reason: 'Invalid PhonePe webhook checksum (X-VERIFY).' };
      }

      return {
        verified: true,
        provider: 'PhonePe',
        parsedData: parsePhonePePayload(body),
      };
    }

    case 'gpay':
    case 'googlepay': {
      const signature = headers['x-gpay-signature'] || headers['x-goog-signature'];
      if (!signature) {
        return { verified: false, statusCode: 400, reason: 'Missing Google Pay signature header.' };
      }
      const gpaySecret = process.env.GPAY_WEBHOOK_SECRET || configuredSecret;
      if (!gpaySecret) {
        return { verified: false, statusCode: 500, reason: 'Google Pay webhook secret not configured on server.' };
      }

      const isValid = verifyGPayWebhook(rawBody, signature, gpaySecret);
      if (!isValid) {
        return { verified: false, statusCode: 401, reason: 'Invalid Google Pay webhook signature.' };
      }

      return {
        verified: true,
        provider: 'Google Pay',
        parsedData: parseGPayPayload(body),
      };
    }

    case 'bankfeed':
    case 'bank': {
      const signature = headers['x-bank-signature'];
      if (!signature) {
        return { verified: false, statusCode: 400, reason: 'Missing Bank signature header.' };
      }
      const bankSecret = process.env.BANK_WEBHOOK_SECRET || configuredSecret;
      if (!bankSecret) {
        return { verified: false, statusCode: 500, reason: 'Bank Feed webhook secret not configured on server.' };
      }

      const isValid = verifyBankFeedWebhook(rawBody, signature, bankSecret);
      if (!isValid) {
        return { verified: false, statusCode: 401, reason: 'Invalid Bank transaction signature.' };
      }

      return {
        verified: true,
        provider: 'Authorized Bank Feed',
        parsedData: parseBankFeedPayload(body),
      };
    }

    default:
      return {
        verified: false,
        statusCode: 400,
        reason: `Unsupported or unknown payment provider: ${provider || 'none'}. Valid signature headers required.`,
      };
  }
};
