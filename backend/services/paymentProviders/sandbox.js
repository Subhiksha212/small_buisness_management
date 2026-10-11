import crypto from 'crypto';

/**
 * Sandbox Webhook Verification Adapter
 * Only available when PAYMENT_ENV === 'sandbox' || process.env.NODE_ENV !== 'production'
 * Strictly verifies x-sandbox-signature against rawBody using sandbox secret.
 * NEVER accepts unverified payloads!
 */
export const verifySandboxWebhook = (rawBody, signature, secret) => {
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
    console.error('Sandbox signature verification error:', error.message);
    return false;
  }
};

/**
 * Normalizes sandbox webhook payload
 */
export const parseSandboxPayload = (body) => {
  return {
    provider: 'Sandbox',
    eventType: body.event || 'payment.success',
    providerPaymentId: body.paymentId || body.providerPaymentId || `SANDBOX_${Date.now()}`,
    providerOrderId: body.orderId || body.providerOrderId || '',
    amount: Number(body.amount || 0),
    currency: body.currency || 'INR',
    status: ['failed', 'pending', 'refunded'].includes(body.status) ? body.status : 'success',
    paymentMethod: body.paymentMethod || 'UPI',
    upiApp: body.upiApp || 'UPI',
    utrNumber: body.utrNumber || `UTR_${Date.now()}`,
    paidTo: body.paidTo || '',
    isTest: true,
  };
};
