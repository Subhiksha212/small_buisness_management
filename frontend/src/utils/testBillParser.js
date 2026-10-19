import { parseReceiptText, standardizeDate, parseCleanAmount } from './billParser.js';

console.log('--- Testing billParser.js ---');

// Test Case 1: Indian Wholesale Grocery Invoice with GST, Line items, Subtotal, and Total
const wholesaleReceipt = `
SRI MEENAKSHI TRADERS
No. 42 Bazaar Road, Madurai - 625001
GSTIN: 33AAAAA0000A1Z5
Phone: 9876543210
TAX INVOICE
Invoice No: SMT-2024-8841
Date: 14/10/2024

ITEMS DESCRIPTION          QTY   RATE     TOTAL
Basmati Rice 25kg Bag       2   1850.00  3700.00
Toor Dal 10kg Bag           1   1450.00  1450.00
Sunflower Oil 15L Tin       1   2100.00  2100.00

Sub Total: 7250.00
CGST @ 2.5%: 181.25
SGST @ 2.5%: 181.25
Grand Total: 7612.50
Paid By: UPI
Thank You Visit Again
`;

const res1 = parseReceiptText(wholesaleReceipt, { data: { confidence: 91.2 } });
console.log('Test 1 - Wholesale Invoice:');
console.log('Merchant:', res1.merchant);
console.log('Invoice #:', res1.invoiceNumber);
console.log('Date:', res1.billDate);
console.log('Subtotal:', res1.subtotal);
console.log('Tax:', res1.tax);
console.log('Total:', res1.amount);
console.log('Category:', res1.category);
console.log('Type:', res1.type);
console.log('Payment Method:', res1.paymentMethod);
console.log('Items Count:', res1.items.length);
console.log('Confidence:', res1.confidence);
console.log('Validation:', res1.validationNotes);

// Assertions for Test 1
if (res1.merchant !== 'SRI MEENAKSHI TRADERS') throw new Error('Test 1 failed: Merchant mismatch');
if (res1.amount !== 7612.5) throw new Error('Test 1 failed: Amount mismatch');
if (res1.subtotal !== 7250) throw new Error('Test 1 failed: Subtotal mismatch');
if (res1.tax !== 362.5) throw new Error('Test 1 failed: Tax mismatch');
if (res1.type !== 'Expense') throw new Error('Test 1 failed: Type mismatch');
if (res1.paymentMethod !== 'UPI') throw new Error('Test 1 failed: Payment method mismatch');
if (res1.confidence !== 91) throw new Error('Test 1 failed: Confidence mismatch');

// Test Case 2: Electricity Bill
const electricityReceipt = `
TANGEDCO / STATE ELECTRICITY BOARD
Consumer No: 07-124-004-9812
Bill Date: 2024-09-28
Due Date: 12/10/2024
Units Consumed: 340 KWh
Energy Charges: ₹1,150.00
Fixed Charges: ₹100.00
Electricity Tax: ₹90.00
NET PAYABLE: ₹1,340.00
`;

const res2 = parseReceiptText(electricityReceipt, { data: { confidence: 88.7 } });
console.log('\nTest 2 - Electricity Bill:');
console.log('Merchant:', res2.merchant);
console.log('Category:', res2.category);
console.log('Total:', res2.amount);
if (res2.amount !== 1340) throw new Error('Test 2 failed: Electricity amount mismatch');
if (res2.category !== 'Electricity') throw new Error('Test 2 failed: Electricity category mismatch');

// Test Case 3: Counter Sale with Phone Number (Ensure phone number is NOT picked as total)
const saleReceipt = `
MODERN SUPERMARKET
Cash Counter #2
Phone: 9841029384
CUSTOMER COPY
Bill No: CS-9042
Date: 12-Oct-2024
Total Items: 3
Total Amount: 450.00
Payment: Cash
`;
const res3 = parseReceiptText(saleReceipt, { data: { confidence: 95.0 } });
console.log('\nTest 3 - Counter Sale:');
console.log('Total:', res3.amount);
if (res3.amount !== 450) throw new Error(`Test 3 failed: Expected 450 but got ${res3.amount}`);

// Test Case 4: Empty / Unreadable text
const res4 = parseReceiptText('', null);
console.log('\nTest 4 - Empty text:');
console.log('Amount:', res4.amount);
console.log('Reliable:', res4.isReliable);
if (res4.isReliable !== false) throw new Error('Test 4 failed: Empty text should not be reliable');

console.log('\nAll Parser Tests Passed Successfully!');
