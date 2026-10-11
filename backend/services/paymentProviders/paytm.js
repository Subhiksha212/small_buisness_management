import crypto from 'crypto';

/**
 * Paytm Webhook Verification Adapter
 * Official verification: HMAC-SHA256 of rawBody using merchant secret key
 * Signature header: x-paytm-signature or CHECKSUMHASH
 */
export const verifyPaytmWebhook = (rawBody, signature, secret) => {
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
    console.error('Paytm signature verification error:', error.message);
    return false;
  }
};

/**
 * Normalizes Paytm webhook payload
 */
export const parsePaytmPayload = (body) => {
  const providerPaymentId = body.TXNID || body.txnId || body.payment_id || '';
  const providerOrderId = body.ORDERID || body.orderId || '';
  const rawAmount = body.TXNAMOUNT || body.amount || 0;
  const amount = Number(rawAmount);
  const currency = body.CURRENCY || 'INR';

  const rawStatus = (body.STATUS || body.status || '').toUpperCase();
  let status = 'pending';
  if (rawStatus === 'TXN_SUCCESS' || rawStatus === 'SUCCESS') {
    status = 'success';
  } else if (rawStatus === 'TXN_FAILURE' || rawStatus === 'FAILED') {
    status = 'failed';
  }

  const rawMode = (body.PAYMENTMODE || body.paymentMode || '').toUpperCase();
  const paymentMethod = rawMode === 'UPI' ? 'UPI' : rawMode.includes('CARD') || rawMode === 'CC' || rawMode === 'DC' ? 'Card' : 'UPI';

  return {
    provider: 'Paytm',
    eventType: body.RESPMSG || rawStatus,
    providerPaymentId,
    providerOrderId,
    amount,
    currency,
    status,
    paymentMethod,
    upiApp: 'Paytm',
    utrNumber: body.BANKTXNID || body.bankTxnId || providerPaymentId,
    isTest: Boolean(process.env.PAYMENT_ENV === 'sandbox'),
  };
};
