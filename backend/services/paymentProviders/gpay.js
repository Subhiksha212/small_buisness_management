import crypto from 'crypto';

/**
 * Google Pay (GPay) Authorized Merchant Webhook Adapter
 * Authenticates incoming Google Pay merchant events using HMAC-SHA256 signature verification.
 */
export const verifyGPayWebhook = (rawBody, signature, secret) => {
  if (!rawBody || !signature || !secret) {
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    const sigBuf = Buffer.from(signature, 'utf8');
    const expBuf = Buffer.from(expectedSignature, 'utf8');

    if (sigBuf.length !== expBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch (error) {
    console.error('Google Pay signature verification error:', error.message);
    return false;
  }
};

/**
 * Normalizes Google Pay merchant payload
 */
export const parseGPayPayload = (body) => {
  const providerPaymentId = body.googleTransactionId || body.paymentId || body.id || `GPAY_${Date.now()}`;
  const providerOrderId = body.merchantOrderId || body.orderId || '';

  // Handle amount in INR or subunits
  const rawAmount = body.amount !== undefined ? body.amount : body.paymentAmount || 0;
  const amount = Number(rawAmount);

  const rawStatus = String(body.status || body.paymentStatus || 'success').toLowerCase();
  let status = 'pending';
  if (rawStatus === 'success' || rawStatus === 'captured' || rawStatus === 'completed') {
    status = 'success';
  } else if (rawStatus === 'failed' || rawStatus === 'declined') {
    status = 'failed';
  } else if (rawStatus === 'refunded') {
    status = 'refunded';
  }

  const utrNumber = body.rrn || body.utr || body.upiTransactionId || providerPaymentId;

  return {
    provider: 'Google Pay',
    eventType: body.event || 'payment.captured',
    providerPaymentId,
    providerOrderId,
    amount,
    currency: body.currency || 'INR',
    status,
    paymentMethod: 'GPay',
    upiApp: 'Google Pay',
    utrNumber,
    isTest: Boolean(body.isTest || process.env.PAYMENT_ENV === 'sandbox'),
  };
};
