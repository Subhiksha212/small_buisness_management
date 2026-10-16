import crypto from 'crypto';
import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();
process.env.NODE_ENV = 'test';
process.env.PAYMENT_ENV = 'sandbox';
process.env.PAYMENT_WEBHOOK_SECRET = 'sandbox_secret_key_98765';

import app from './server.js';
import User from './models/User.js';
import Product from './models/Product.js';
import Order from './models/Order.js';
import Sale from './models/Sale.js';
import Expense from './models/Expense.js';
import PaymentTransaction from './models/PaymentTransaction.js';
import InventoryMovement from './models/InventoryMovement.js';
import sseService from './services/sseService.js';

const SECRET = 'sandbox_secret_key_98765';

function signPayload(rawBody, secret = SECRET) {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

async function runTests() {
  console.log('====================================================');
  console.log('RUNNING FULL REAL-TIME PAYMENT ARCHITECTURE TEST SUITE');
  console.log('====================================================\n');

  // Start HTTP server on dynamic port
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`[SETUP] Test server running on ${baseUrl}`);

  // Ensure DB connected
  if (mongoose.connection.readyState !== 1) {
    await new Promise((resolve) => mongoose.connection.once('open', resolve));
  }
  console.log('[SETUP] Connected to MongoDB Atlas successfully.\n');

  // Setup test users
  const testUserA = await User.findOneAndUpdate(
    { email: 'user_a_test@business.com' },
    { name: 'Business Owner A', email: 'user_a_test@business.com', passwordHash: 'hash_a', currency: 'INR' },
    { upsert: true, new: true }
  );

  const testUserB = await User.findOneAndUpdate(
    { email: 'user_b_test@business.com' },
    { name: 'Business Owner B', email: 'user_b_test@business.com', passwordHash: 'hash_b', currency: 'INR' },
    { upsert: true, new: true }
  );

  const tokenA = jwt.sign({ id: testUserA._id }, process.env.JWT_SECRET || 'smart_business_jwt_secret_key_987654321');
  const tokenB = jwt.sign({ id: testUserB._id }, process.env.JWT_SECRET || 'smart_business_jwt_secret_key_987654321');

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

  try {
    // ----------------------------------------------------
    // TEST 1: Valid signed sandbox payment
    // ----------------------------------------------------
    console.log('--- TEST 1: Valid signed sandbox payment ---');
    const paymentId1 = `SANDBOX_TXN_${Date.now()}_1`;
    const payload1 = JSON.stringify({
      event: 'payment.success',
      paymentId: paymentId1,
      amount: 450,
      currency: 'INR',
      status: 'success',
      paymentMethod: 'UPI',
      upiApp: 'Google Pay',
    });
    const sig1 = signPayload(payload1);

    const res1 = await fetch(`${baseUrl}/api/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sandbox-signature': sig1,
      },
      body: payload1,
    });
    const json1 = await res1.json();
    assert(res1.status === 200, `Returns HTTP 200 OK (got ${res1.status})`);
    assert(json1.success === true, 'Response indicates success');

    const dbTxn1 = await PaymentTransaction.findOne({ provider: 'Sandbox', providerPaymentId: paymentId1 });
    assert(Boolean(dbTxn1 && dbTxn1.amount === 450), `Payment saved in database once with amount ₹450`);

    // ----------------------------------------------------
    // TEST 2: Invalid signature
    // ----------------------------------------------------
    console.log('\n--- TEST 2: Invalid signature rejection ---');
    const payload2 = JSON.stringify({
      event: 'payment.success',
      paymentId: `SANDBOX_TAMPER_${Date.now()}`,
      amount: 9999,
      status: 'success',
    });
    const badSig = 'tampered_fake_signature_1234567890abcdef';

    const res2 = await fetch(`${baseUrl}/api/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sandbox-signature': badSig,
      },
      body: payload2,
    });
    assert(res2.status === 401, `Invalid signature rejected with 401 Unauthorized (got ${res2.status})`);

    const missingSigRes = await fetch(`${baseUrl}/api/payments/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload2,
    });
    assert(missingSigRes.status === 400 || missingSigRes.status === 401, `Missing signature rejected (got ${missingSigRes.status})`);

    // ----------------------------------------------------
    // TEST 3: Duplicate webhook (Idempotency)
    // ----------------------------------------------------
    console.log('\n--- TEST 3: Duplicate webhook idempotency ---');
    const res3 = await fetch(`${baseUrl}/api/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sandbox-signature': sig1,
      },
      body: payload1,
    });
    const json3 = await res3.json();
    assert(res3.status === 200, `Returns HTTP 200 OK for duplicate (got ${res3.status})`);
    assert(json3.duplicate === true, 'Recognized duplicate webhook without re-processing');

    const countTxn = await PaymentTransaction.countDocuments({ provider: 'Sandbox', providerPaymentId: paymentId1 });
    assert(countTxn === 1, `Exactly 1 transaction record exists in DB (got ${countTxn})`);

    // ----------------------------------------------------
    // TEST 4 & TEST 11: Real-Time SSE Emission & User Isolation
    // ----------------------------------------------------
    console.log('\n--- TEST 4 & 11: SSE Emission & Strict User Isolation ---');
    let userAReceived = false;
    let userBReceived = false;

    // Simulate SSE clients
    const mockResA = {
      writeHead: () => {},
      write: (data) => {
        if (data.includes('payment.success')) userAReceived = true;
      },
    };
    const mockReqA = { on: () => {} };

    const mockResB = {
      writeHead: () => {},
      write: (data) => {
        if (data.includes('payment.success')) userBReceived = true;
      },
    };
    const mockReqB = { on: () => {} };

    sseService.addClient(testUserA._id, mockResA, mockReqA);
    sseService.addClient(testUserB._id, mockResB, mockReqB);

    // Emit event strictly for User A
    sseService.emitToUser(testUserA._id, 'payment.success', {
      provider: 'Sandbox',
      amount: 450,
      test: true,
    });

    assert(userAReceived === true, 'User A received real-time SSE event');
    assert(userBReceived === false, 'User B did NOT receive User A event (strict channel isolation enforced)');

    // ----------------------------------------------------
    // TEST 5: Failed payment
    // ----------------------------------------------------
    console.log('\n--- TEST 5: Failed payment status handling ---');
    const paymentIdFailed = `SANDBOX_FAIL_${Date.now()}`;
    const payloadFailed = JSON.stringify({
      event: 'payment.failed',
      paymentId: paymentIdFailed,
      amount: 700,
      status: 'failed',
    });
    const sigFailed = signPayload(payloadFailed);

    const res5 = await fetch(`${baseUrl}/api/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sandbox-signature': sigFailed,
      },
      body: payloadFailed,
    });
    assert(res5.status === 200, `Returns HTTP 200 acknowledging failed webhook (got ${res5.status})`);

    const failedTxn = await PaymentTransaction.findOne({ providerPaymentId: paymentIdFailed });
    assert(Boolean(failedTxn && failedTxn.paymentStatus === 'failed'), 'Recorded in transactions as failed status');

    const saleFromFailed = await Sale.findOne({ providerTransactionId: paymentIdFailed });
    assert(!saleFromFailed, 'No Sale record created for failed payment (revenue unchanged)');

    // ----------------------------------------------------
    // TEST 6: Pending payment
    // ----------------------------------------------------
    console.log('\n--- TEST 6: Pending payment handling ---');
    const paymentIdPending = `SANDBOX_PENDING_${Date.now()}`;
    const payloadPending = JSON.stringify({
      event: 'payment.pending',
      paymentId: paymentIdPending,
      amount: 300,
      status: 'pending',
    });
    const sigPending = signPayload(payloadPending);

    const res6 = await fetch(`${baseUrl}/api/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sandbox-signature': sigPending,
      },
      body: payloadPending,
    });
    const pendingTxn = await PaymentTransaction.findOne({ providerPaymentId: paymentIdPending });
    assert(Boolean(pendingTxn && pendingTxn.paymentStatus === 'pending'), 'Payment recorded as pending');
    const saleFromPending = await Sale.findOne({ providerTransactionId: paymentIdPending });
    assert(!saleFromPending, 'No Sale finalized for pending payment');

    // ----------------------------------------------------
    // TEST 7: Wrong amount rejection (Frontend price manipulation protection)
    // ----------------------------------------------------
    console.log('\n--- TEST 7: Wrong amount mismatch protection ---');
    // Create a product with authoritative backend price
    const product1 = await Product.create({
      userId: testUserA._id,
      name: 'Wireless Mouse',
      price: 600, // ₹600 authoritative price
      stockQuantity: 20,
    });

    // Create an order for 2 mice (Total: ₹1200 calculated by server)
    const orderRes = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        items: [{ productId: product1._id, quantity: 2 }],
        paymentMethod: 'UPI',
      }),
    });
    const orderJson = await orderRes.json();
    assert(orderRes.status === 201, 'Order created with backend price calculation');
    assert(orderJson.order.totalAmount === 1200, `Server authoritative total is ₹1200 (got ${orderJson.order.totalAmount})`);

    const orderNumber = orderJson.order.orderNumber;

    // Hacker tries to send webhook for only ₹100 instead of ₹1200
    const paymentIdMismatch = `SANDBOX_TAMPER_AMT_${Date.now()}`;
    const payloadMismatch = JSON.stringify({
      event: 'payment.success',
      paymentId: paymentIdMismatch,
      orderId: orderNumber,
      amount: 100, // TAMPERED AMOUNT
      status: 'success',
    });
    const sigMismatch = signPayload(payloadMismatch);

    const res7 = await fetch(`${baseUrl}/api/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sandbox-signature': sigMismatch,
      },
      body: payloadMismatch,
    });
    assert(res7.status === 400, `Rejected amount mismatch with HTTP 400 (got ${res7.status})`);

    const checkOrder7 = await Order.findOne({ orderNumber });
    assert(checkOrder7.status === 'pending', 'Order remains pending, not marked paid');
    const checkProduct7 = await Product.findById(product1._id);
    assert(checkProduct7.stockQuantity === 20, 'Product stock was NOT deducted on amount mismatch');

    // ----------------------------------------------------
    // TEST 8: Unknown order / Direct Payment (no inventory deduction)
    // ----------------------------------------------------
    console.log('\n--- TEST 8: Unknown order / direct payment handling ---');
    const paymentIdDirect = `SANDBOX_DIRECT_${Date.now()}`;
    const payloadDirect = JSON.stringify({
      event: 'payment.success',
      paymentId: paymentIdDirect,
      amount: 500,
      status: 'success',
      description: 'Direct QR code scan',
    });
    const sigDirect = signPayload(payloadDirect);

    const res8 = await fetch(`${baseUrl}/api/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sandbox-signature': sigDirect,
      },
      body: payloadDirect,
    });
    assert(res8.status === 200, 'Direct payment processed');
    const directSale = await Sale.findOne({ providerTransactionId: paymentIdDirect });
    assert(Boolean(directSale && directSale.amount === 500), 'Direct sale recorded');
    const initialMovementsCount = await InventoryMovement.countDocuments({ reason: /Direct/ });
    assert(initialMovementsCount === 0, 'No random inventory movements created for direct payment without order');

    // ----------------------------------------------------
    // TEST 9: Correct product order + successful payment (Order -> Payment -> Inventory)
    // ----------------------------------------------------
    console.log('\n--- TEST 9: Correct order + payment + inventory deduction ---');
    const paymentIdOrderValid = `SANDBOX_ORDER_PAY_${Date.now()}`;
    const payloadValidOrder = JSON.stringify({
      event: 'payment.success',
      paymentId: paymentIdOrderValid,
      orderId: orderNumber,
      amount: 1200, // Exact match
      status: 'success',
      paymentMethod: 'UPI',
    });
    const sigValidOrder = signPayload(payloadValidOrder);

    const res9 = await fetch(`${baseUrl}/api/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sandbox-signature': sigValidOrder,
      },
      body: payloadValidOrder,
    });
    assert(res9.status === 200, 'Valid order payment succeeded');

    const updatedOrder = await Order.findOne({ orderNumber });
    assert(updatedOrder.status === 'paid', 'Order marked status: paid');
    assert(updatedOrder.inventoryDeducted === true, 'Order inventoryDeducted flag set to true');

    const updatedProduct = await Product.findById(product1._id);
    assert(updatedProduct.stockQuantity === 18, `Stock reduced by 2: from 20 to ${updatedProduct.stockQuantity}`);

    const movement = await InventoryMovement.findOne({ orderId: updatedOrder._id });
    assert(Boolean(movement && movement.quantityChanged === -2 && movement.newStock === 18), 'InventoryMovement record created for audit trail');

    const orderSale = await Sale.findOne({ orderId: updatedOrder._id });
    assert(Boolean(orderSale && orderSale.amount === 1200), 'Sale record created linked to orderId');

    // ----------------------------------------------------
    // TEST 10: SSE Authentication & Handshake
    // ----------------------------------------------------
    console.log('\n--- TEST 10: SSE Stream Authentication ---');
    const unauthSseRes = await fetch(`${baseUrl}/api/events`);
    assert(unauthSseRes.status === 401, `Unauthenticated SSE request rejected with 401 (got ${unauthSseRes.status})`);

    const authSseRes = await fetch(`${baseUrl}/api/events?token=${tokenA}`, {
      headers: { Accept: 'text/event-stream' },
    });
    assert(authSseRes.status === 200, `Authenticated SSE request accepted with 200 OK (got ${authSseRes.status})`);
    assert(authSseRes.headers.get('content-type').includes('text/event-stream'), 'Content-Type is text/event-stream');

    // ----------------------------------------------------
    // TEST 12: Database Source of Truth Persistence
    // ----------------------------------------------------
    console.log('\n--- TEST 12: Database Persistence & Dashboard Totals ---');
    const dashRes = await fetch(`${baseUrl}/api/dashboard`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const dashData = await dashRes.json();
    assert(dashRes.status === 200, 'Dashboard data retrieved from MongoDB');
    assert(dashData.totalSales >= 1200, `Dashboard totals derived from DB records: totalSales = ₹${dashData.totalSales}`);

    // ----------------------------------------------------
    // TEST 13: Strict Test-Payment Exclusion from Real Production Revenue
    // ----------------------------------------------------
    console.log('\n--- TEST 13: Strict Test-Payment Exclusion from Production Revenue ---');
    const prodDashRes = await fetch(`${baseUrl}/api/dashboard?includeTest=false`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const prodDashData = await prodDashRes.json();
    assert(prodDashRes.status === 200, 'Production dashboard query returned 200 OK');
    assert(
      prodDashData.totalSales === 0,
      `Sandbox transactions strictly excluded from production totals (expected ₹0, got ₹${prodDashData.totalSales})`
    );

    // ----------------------------------------------------
    // TEST 14: Multi-Tenant Data Isolation
    // ----------------------------------------------------
    console.log('\n--- TEST 14: Strict Multi-Tenant Data Isolation ---');
    // User B attempts to access User A's product
    const userBProductsRes = await fetch(`${baseUrl}/api/products`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const userBProducts = await userBProductsRes.json();
    const hasUserAProduct = userBProducts.some((p) => String(p._id) === String(product1._id));
    assert(hasUserAProduct === false, "User B cannot see User A's products (Strict multi-tenant isolation)");

    // User B attempts to query User A's order
    const userBOrderRes = await fetch(`${baseUrl}/api/orders/${orderJson.order._id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(userBOrderRes.status === 404, "User B gets 404 when requesting User A's order by ID");

    // ----------------------------------------------------
    // TEST 15: Duplicate UTR / Reference Number Detection
    // ----------------------------------------------------
    console.log('\n--- TEST 15: Duplicate UTR / Reference Detection ---');
    const existingUtr = paymentIdOrderValid;
    const dupCheckRes = await fetch(`${baseUrl}/api/payments/check-reference?utr=${existingUtr}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const dupCheckData = await dupCheckRes.json();
    assert(dupCheckRes.status === 200, 'Check reference API returned 200 OK');
    assert(dupCheckData.exists === true, 'Detected duplicate reference number correctly');

    const freshUtr = `UNIQUE_UTR_${Date.now()}`;
    const freshCheckRes = await fetch(`${baseUrl}/api/payments/check-reference?utr=${freshUtr}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const freshCheckData = await freshCheckRes.json();
    assert(freshCheckData.exists === false, 'Unique reference number passed without conflict');

    // ----------------------------------------------------
    // TEST 16: Inventory Low-Stock Alert & Product Reports
    // ----------------------------------------------------
    console.log('\n--- TEST 16: Inventory Valuation & Reorder Reports ---');
    const invReportRes = await fetch(`${baseUrl}/api/products/reports`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const invReportData = await invReportRes.json();
    assert(invReportRes.status === 200, 'Inventory reports API returned 200 OK');
    assert(invReportData.totalProducts >= 1, `Total products reported accurately (got ${invReportData.totalProducts})`);
    assert(typeof invReportData.totalStockValueAtRetail === 'number', 'Total stock valuation computed correctly');

    // ----------------------------------------------------
    // TEST 17: Practical Explainable Insights API
    // ----------------------------------------------------
    console.log('\n--- TEST 17: Business Forecasting & Insights API ---');
    const insightsRes = await fetch(`${baseUrl}/api/dashboard/insights`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const insightsData = await insightsRes.json();
    assert(insightsRes.status === 200, 'Insights API returned 200 OK');
    assert(Array.isArray(insightsData.insights), 'Insights list returned as array');
    assert(
      insightsData.insights.every((i) => i.recommendation && i.reason && i.suggestedAction),
      'Every insight includes explainable recommendation, metric reason, and suggested action'
    );

    console.log('\n====================================================');
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');
  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    await new Promise((resolve) => server.close(resolve));
    process.exit(failed === 0 ? 0 : 1);
  }
}

runTests();

