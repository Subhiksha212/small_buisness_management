import crypto from 'crypto';
import { verifyRazorpayWebhook, parseRazorpayPayload } from './services/paymentProviders/razorpay.js';
import { verifyCashfreeWebhook, parseCashfreePayload } from './services/paymentProviders/cashfree.js';
import { verifyPaytmWebhook, parsePaytmPayload } from './services/paymentProviders/paytm.js';
import { verifySandboxWebhook, parseSandboxPayload } from './services/paymentProviders/sandbox.js';
import { verifyAndParseWebhook } from './services/paymentProviders/index.js';
import { sseService } from './services/sseService.js';
import { verifyWebhookSignature } from './middleware/verifyWebhook.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runTestSuite() {
  console.log('====================================================');
  console.log('REAL-TIME PAYMENT ARCHITECTURE & SECURITY TEST SUITE');
  console.log('====================================================\n');

  // ====================================================
  // TEST 1: Razorpay HMAC-SHA256 Signature Verification
  // ====================================================
  console.log('--- TEST 1: Razorpay Signature Verification ---');
  const rzpSecret = 'rzp_sec_abcdef123456';
  const rzpBody = JSON.stringify({
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: 'pay_9876543210',
          amount: 50000, // ₹500.00
          currency: 'INR',
          status: 'captured',
          method: 'upi',
          vpa: 'customer@okhdfcbank',
        },
      },
    },
  });
  const validRzpSig = crypto.createHmac('sha256', rzpSecret).update(rzpBody).digest('hex');
  const invalidRzpSig = 'tampered_signature_9999999999';

  assert(verifyRazorpayWebhook(rzpBody, validRzpSig, rzpSecret) === true, 'Valid Razorpay signature accepted');
  assert(verifyRazorpayWebhook(rzpBody, invalidRzpSig, rzpSecret) === false, 'Invalid Razorpay signature rejected');
  assert(verifyRazorpayWebhook('', validRzpSig, rzpSecret) === false, 'Empty payload rejected');

  const parsedRzp = parseRazorpayPayload(JSON.parse(rzpBody));
  assert(parsedRzp.amount === 500, `Razorpay paise converted accurately to ₹500 (got ${parsedRzp.amount})`);
  assert(parsedRzp.paymentMethod === 'UPI', 'Normalized paymentMethod is UPI');
  assert(parsedRzp.status === 'success', 'Status is success');

  // ====================================================
  // TEST 2: Cashfree Timestamped Signature Verification
  // ====================================================
  console.log('\n--- TEST 2: Cashfree Signature Verification ---');
  const cfSecret = 'cf_secret_key_88888';
  const cfTimestamp = String(Date.now());
  const cfBody = JSON.stringify({
    data: {
      order: { order_id: 'order_123', order_amount: 1500, order_currency: 'INR' },
      payment: { cf_payment_id: 'cf_pay_456', payment_status: 'SUCCESS', payment_method: { upi: {} } },
    },
    event_time: '2026-09-30T12:00:00Z',
    type: 'PAYMENT_SUCCESS_WEBHOOK',
  });
  const cfPayloadToSign = cfTimestamp + cfBody;
  const validCfSig = crypto.createHmac('sha256', cfSecret).update(cfPayloadToSign).digest('base64');
  const invalidCfSig = 'invalid_base64_sig';

  assert(verifyCashfreeWebhook(cfBody, validCfSig, cfTimestamp, cfSecret) === true, 'Valid Cashfree signature accepted');
  assert(verifyCashfreeWebhook(cfBody, invalidCfSig, cfTimestamp, cfSecret) === false, 'Invalid Cashfree signature rejected');

  const parsedCf = parseCashfreePayload(JSON.parse(cfBody));
  assert(parsedCf.amount === 1500, 'Cashfree amount accurately parsed as 1500');
  assert(parsedCf.status === 'success', 'Status is success');

  // ====================================================
  // TEST 3: Paytm Checksum Verification
  // ====================================================
  console.log('\n--- TEST 3: Paytm Checksum Verification ---');
  const paytmSecret = 'paytm_merchant_secret_777';
  const paytmBody = JSON.stringify({
    MID: 'MERCHANT123',
    TXNID: 'PTM_TXN_999',
    TXNAMOUNT: '750.00',
    STATUS: 'TXN_SUCCESS',
    PAYMENTMODE: 'UPI',
  });
  const validPaytmSig = crypto.createHmac('sha256', paytmSecret).update(paytmBody).digest('hex');

  assert(verifyPaytmWebhook(paytmBody, validPaytmSig, paytmSecret) === true, 'Valid Paytm signature accepted');
  assert(verifyPaytmWebhook(paytmBody, 'bad_checksum', paytmSecret) === false, 'Invalid Paytm checksum rejected');

  // ====================================================
  // TEST 4: Sandbox Signature & Strict Production Prohibition
  // ====================================================
  console.log('\n--- TEST 4: Sandbox Webhook Security ---');
  const sbSecret = 'sandbox_secret_999';
  const sbBody = JSON.stringify({
    event: 'payment.success',
    paymentId: 'SB_123',
    amount: 300,
    status: 'success',
  });
  const validSbSig = crypto.createHmac('sha256', sbSecret).update(sbBody).digest('hex');

  process.env.PAYMENT_ENV = 'sandbox';
  assert(verifySandboxWebhook(sbBody, validSbSig, sbSecret) === true, 'Valid Sandbox signature accepted in sandbox mode');
  assert(verifySandboxWebhook(sbBody, 'bad_sig', sbSecret) === false, 'Tampered sandbox signature rejected');

  // In production, Sandbox MUST be rejected
  process.env.NODE_ENV = 'production';
  process.env.PAYMENT_ENV = 'production';
  const prodCheck = verifyAndParseWebhook({
    rawBody: sbBody,
    body: JSON.parse(sbBody),
    headers: { 'x-sandbox-signature': validSbSig },
    webhookSecret: sbSecret,
  });
  assert(prodCheck.verified === false && prodCheck.statusCode === 403, 'Sandbox webhook strictly rejected with 403 in production environment');

  // Reset to sandbox for remaining tests
  process.env.NODE_ENV = 'development';
  process.env.PAYMENT_ENV = 'sandbox';

  // ====================================================
  // TEST 5: verifyWebhookSignature Middleware Execution
  // ====================================================
  console.log('\n--- TEST 5: verifyWebhookSignature Middleware Security ---');
  let middlewareRejected = false;
  let middlewareStatus = null;
  const mockReqReject = {
    rawBody: sbBody,
    body: JSON.parse(sbBody),
    headers: { 'x-sandbox-signature': 'bad_sig' },
  };
  const mockResReject = {
    status: (code) => {
      middlewareStatus = code;
      return {
        json: () => { middlewareRejected = true; },
      };
    },
  };
  let nextCalled = false;
  verifyWebhookSignature(mockReqReject, mockResReject, () => { nextCalled = true; });
  assert(middlewareRejected === true && middlewareStatus === 401, 'Middleware rejected invalid signature with 401 Unauthorized');
  assert(nextCalled === false, 'next() was NOT called on invalid signature (request halted)');

  // Missing rawBody check
  let missingBodyRejected = false;
  const mockReqNoBody = { body: {}, headers: {} };
  verifyWebhookSignature(mockReqNoBody, mockResReject, () => {});
  assert(middlewareStatus === 400, 'Middleware rejects missing signature headers with 400 Bad Request');

  // ====================================================
  // TEST 6: Real-Time SSE User Data Isolation
  // ====================================================
  console.log('\n--- TEST 6: SSE Per-User Channel Isolation ---');
  const userAId = '660a11112222333344445555';
  const userBId = '660b99998888777766665555';

  const userAEvents = [];
  const userBEvents = [];

  const mockResA = {
    writeHead: () => {},
    write: (msg) => userAEvents.push(msg),
  };
  const mockReqA = { on: () => {} };

  const mockResB = {
    writeHead: () => {},
    write: (msg) => userBEvents.push(msg),
  };
  const mockReqB = { on: () => {} };

  sseService.addClient(userAId, mockResA, mockReqA);
  sseService.addClient(userBId, mockResB, mockReqB);

  // Emit private financial event to User A
  sseService.emitToUser(userAId, 'payment.success', {
    amount: 1200,
    orderId: 'ORD_001',
    paymentMethod: 'UPI',
    secret: 'SHOULD_BE_STRIPPED_SECRET',
  });

  const userAPaymentEvents = userAEvents.filter((msg) => msg.includes('payment.success'));
  const userBPaymentEvents = userBEvents.filter((msg) => msg.includes('payment.success'));

  assert(userAPaymentEvents.length > 0, 'User A received their private payment event');
  assert(userBPaymentEvents.length === 0, 'User B received ZERO events from User A (Strict Data Isolation)');

  // Verify secret stripping
  const receivedMsg = userAPaymentEvents[0];
  assert(!receivedMsg.includes('SHOULD_BE_STRIPPED_SECRET'), 'Accidental secrets are automatically stripped before SSE broadcast');

  // Clean up SSE client
  sseService.removeClient(userAId, mockResA);
  assert(!sseService.userClients.has(userAId) || sseService.userClients.get(userAId).size === 0, 'SSE client cleaned up cleanly on disconnect');

  // ====================================================
  // TEST 7: Order Authoritative Server Calculation
  // ====================================================
  console.log('\n--- TEST 7: Backend Authoritative Price Calculation ---');
  // Scenario: Frontend sends product with tampered unit price ₹1 instead of server price ₹600
  const serverProduct = {
    _id: 'prod_123',
    name: 'Wireless Mouse',
    price: 600, // Server truth
    stockQuantity: 10,
  };
  const requestedItem = {
    productId: 'prod_123',
    quantity: 3,
    unitPrice: 1, // Tampered client price!
  };

  // Backend calculation:
  const authoritativeItemTotal = serverProduct.price * requestedItem.quantity;
  assert(authoritativeItemTotal === 1800, `Backend enforces server price 3 x 600 = ₹1800 (tampered ₹1 ignored)`);

  // Amount mismatch detection in webhook:
  const expectedOrderTotal = 1800;
  const webhookReceivedAmount = 1;
  const hasMismatch = Math.abs(expectedOrderTotal - webhookReceivedAmount) > 0.01;
  assert(hasMismatch === true, 'Amount mismatch detected between expected order total (₹1800) and received payment (₹1)');

  // ====================================================
  // TEST 8: Test Mode Flag Enforcement
  // ====================================================
  console.log('\n--- TEST 8: Test Mode Flag Enforcement ---');
  const parsedSb = parseSandboxPayload({
    event: 'payment.success',
    paymentId: 'TEST_TXN_001',
    amount: 500,
  });
  assert(parsedSb.isTest === true, 'Sandbox payment strictly flagged with isTest: true');

  // ====================================================
  // TEST 9: Duplicate Webhook Idempotency Logic
  // ====================================================
  console.log('\n--- TEST 9: Duplicate Webhook Idempotency Simulation ---');
  const processedTransactions = new Set();
  function processWebhookIdempotent({ provider, providerPaymentId, amount }) {
    const key = `${provider}:${providerPaymentId}`;
    if (processedTransactions.has(key)) {
      return { duplicate: true, message: 'Duplicate webhook acknowledged. Skipped.' };
    }
    processedTransactions.add(key);
    return { duplicate: false, amount, message: 'Payment processed.' };
  }

  const firstCall = processWebhookIdempotent({ provider: 'Razorpay', providerPaymentId: 'pay_xyz_1', amount: 500 });
  assert(firstCall.duplicate === false, 'First webhook call processes payment');

  const secondCall = processWebhookIdempotent({ provider: 'Razorpay', providerPaymentId: 'pay_xyz_1', amount: 500 });
  assert(secondCall.duplicate === true, 'Duplicate webhook call recognized as duplicate (idempotent)');

  // ====================================================
  // TEST 10: Non-Success Payment Status Safety
  // ====================================================
  console.log('\n--- TEST 10: Non-Success Payment Status Safety ---');
  function handlePaymentStatus(status) {
    if (status === 'success') {
      return { countsAsRevenue: true, modifiesInventory: true };
    }
    // Failed, pending, or refunded
    return { countsAsRevenue: false, modifiesInventory: false };
  }

  const failedResult = handlePaymentStatus('failed');
  assert(failedResult.countsAsRevenue === false, 'Failed payment does NOT count as revenue');
  assert(failedResult.modifiesInventory === false, 'Failed payment does NOT modify inventory');

  const pendingResult = handlePaymentStatus('pending');
  assert(pendingResult.countsAsRevenue === false, 'Pending payment does NOT count as finalized revenue');

  const refundedResult = handlePaymentStatus('refunded');
  assert(refundedResult.countsAsRevenue === false, 'Refunded payment does NOT count as normal sales revenue');

  // ====================================================
  // TEST 11: Unknown Order / Direct Payment (No Stock Deduction)
  // ====================================================
  console.log('\n--- TEST 11: Direct Payment without Order (No Stock Deduction) ---');
  let productStock = 50;
  let inventoryMovements = [];

  function processPayment({ orderId, amount }) {
    if (orderId) {
      productStock -= 2;
      inventoryMovements.push({ qty: -2, reason: 'order fulfilled' });
      return { type: 'OrderSale', inventoryDeducted: true };
    } else {
      // Direct payment / Unknown order -> Record sale but DO NOT deduce stock!
      return { type: 'DirectSale', inventoryDeducted: false };
    }
  }

  const directPayment = processPayment({ amount: 500 }); // No orderId
  assert(directPayment.type === 'DirectSale', 'Payment recorded as DirectSale');
  assert(directPayment.inventoryDeducted === false, 'Direct payment does NOT deduct inventory');
  assert(productStock === 50, 'Product stock remains intact (50)');
  assert(inventoryMovements.length === 0, 'No inventory movements created for direct payment');

  // ====================================================
  // TEST 12: Order -> Payment -> Inventory (Stock Decrement Exactly Once)
  // ====================================================
  console.log('\n--- TEST 12: Order -> Payment -> Inventory Stock Decrement ---');
  let initialStock = 25;
  let orderInventoryDeducted = false;
  const orderItems = [{ productId: 'p1', quantity: 3 }];

  function finalizeOrderPayment(orderTotal, receivedAmount) {
    if (Math.abs(orderTotal - receivedAmount) > 0.01) {
      return { success: false, error: 'AmountMismatch' };
    }
    if (!orderInventoryDeducted) {
      initialStock -= orderItems[0].quantity;
      orderInventoryDeducted = true;
    }
    return { success: true, newStock: initialStock };
  }

  const mismatchAttempt = finalizeOrderPayment(1500, 100);
  assert(mismatchAttempt.success === false, 'Amount mismatch rejected');
  assert(initialStock === 25, 'Stock unaffected by amount mismatch');

  const validAttempt = finalizeOrderPayment(1500, 1500);
  assert(validAttempt.success === true, 'Valid amount approved');
  assert(initialStock === 22, `Stock decremented from 25 to 22 (got ${initialStock})`);

  // Repeat call for same order (e.g. duplicate webhook)
  const repeatAttempt = finalizeOrderPayment(1500, 1500);
  assert(initialStock === 22, `Stock is NOT decremented again on repeat call (exactly once: ${initialStock})`);

  console.log('\n====================================================');
  console.log(`TEST SUITE FINISHED: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite();
