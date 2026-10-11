import crypto from 'crypto';

/**
 * Razorpay Webhook Verification Adapter
 * Official verification: HMAC-SHA256 of rawBody using webhook secret
 * Signature header: x-razorpay-signature
 */
export const verifyRazorpayWebhook = (rawBody, signature, secret) => {
  if (!rawBody || !signature || !secret) {
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    const signatureBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch (error) {
    console.error('Razorpay signature verification error:', error.message);
    return false;
  }
};

/**
 * Normalizes Razorpay webhook payload into standard application payment structure
 */
export const parseRazorpayPayload = (body) => {
  const event = body.event; // e.g. 'payment.captured', 'payment.failed', 'order.paid'
  const paymentEntity = body.payload?.payment?.entity || {};
  const orderEntity = body.payload?.order?.entity || {};

  const providerPaymentId = paymentEntity.id || body.payment_id || '';
  const providerOrderId = paymentEntity.order_id || orderEntity.id || body.order_id || '';
  const rawAmount = paymentEntity.amount !== undefined ? paymentEntity.amount : orderEntity.amount;
  // Razorpay amounts are in paise (e.g. 50000 = ₹500.00)
  const amount = rawAmount !== undefined ? Number(rawAmount) / 100 : 0;
  const currency = paymentEntity.currency || orderEntity.currency || 'INR';

  let status = 'pending';
  if (event === 'payment.captured' || event === 'order.paid' || paymentEntity.status === 'captured') {
    status = 'success';
  } else if (event === 'payment.failed' || paymentEntity.status === 'failed') {
    status = 'failed';
  } else if (event === 'payment.refunded' || paymentEntity.status === 'refunded') {
    status = 'refunded';
  }

  // Method normalization: upi, card, netbanking, etc.
  const rawMethod = (paymentEntity.method || '').toLowerCase();
  const paymentMethod = rawMethod === 'upi' ? 'UPI' : rawMethod === 'card' ? 'Card' : 'UPI';
  const upiApp = paymentEntity.vpa ? 'UPI' : 'Razorpay';

  return {
    provider: 'Razorpay',
    eventType: event,
    providerPaymentId,
    providerOrderId,
    amount,
    currency,
    status,
    paymentMethod,
    upiApp,
    utrNumber: paymentEntity.acquirer_data?.rrn || paymentEntity.acquirer_data?.upi_transaction_id || providerPaymentId,
    isTest: Boolean(body.isTest || process.env.PAYMENT_ENV === 'sandbox'),
  };
};
