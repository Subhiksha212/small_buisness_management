import crypto from 'crypto';

/**
 * Cashfree Webhook Verification Adapter
 * Official verification: HMAC-SHA256 of (timestamp + rawBody) using secret, base64 encoded
 * Signature header: x-webhook-signature
 * Timestamp header: x-webhook-timestamp
 */
export const verifyCashfreeWebhook = (rawBody, signature, timestamp, secret) => {
  if (!rawBody || !signature || !timestamp || !secret) {
    return false;
  }

  try {
    const payload = `${timestamp}${rawBody}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('base64');

    const signatureBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch (error) {
    console.error('Cashfree signature verification error:', error.message);
    return false;
  }
};

/**
 * Normalizes Cashfree webhook payload
 */
export const parseCashfreePayload = (body) => {
  const data = body.data || body;
  const event = body.type || body.event; // e.g. 'PAYMENT_SUCCESS_WEBHOOK'

  const payment = data.payment || {};
  const order = data.order || {};

  const providerPaymentId = payment.cf_payment_id ? String(payment.cf_payment_id) : (data.cf_payment_id || data.referenceId || '');
  const providerOrderId = order.order_id || data.orderId || data.order_id || '';
  const amount = Number(payment.payment_amount || order.order_amount || data.orderAmount || 0);
  const currency = payment.payment_currency || order.order_currency || 'INR';

  const rawStatus = (payment.payment_status || data.txStatus || '').toUpperCase();
  let status = 'pending';
  if (rawStatus === 'SUCCESS' || event === 'PAYMENT_SUCCESS_WEBHOOK') {
    status = 'success';
  } else if (rawStatus === 'FAILED' || event === 'PAYMENT_FAILED_WEBHOOK') {
    status = 'failed';
  } else if (rawStatus === 'USER_DROPPED' || rawStatus === 'CANCELLED') {
    status = 'failed';
  }

  let rawMethod = '';
  if (typeof payment.payment_method === 'string') {
    rawMethod = payment.payment_method.toUpperCase();
  } else if (payment.payment_method && typeof payment.payment_method === 'object') {
    rawMethod = Object.keys(payment.payment_method)[0]?.toUpperCase() || '';
  } else if (typeof data.paymentMode === 'string') {
    rawMethod = data.paymentMode.toUpperCase();
  }
  const paymentMethod = rawMethod.includes('UPI') ? 'UPI' : rawMethod.includes('CARD') ? 'Card' : 'UPI';

  return {
    provider: 'Cashfree',
    eventType: event,
    providerPaymentId,
    providerOrderId,
    amount,
    currency,
    status,
    paymentMethod,
    upiApp: paymentMethod === 'UPI' ? 'Cashfree UPI' : 'Cashfree',
    utrNumber: payment.bank_reference || data.referenceId || providerPaymentId,
    isTest: Boolean(process.env.PAYMENT_ENV === 'sandbox'),
  };
};
