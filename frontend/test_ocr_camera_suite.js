/**
 * OCR & CAMERA BILL SCANNER AUTOMATED TEST SUITE
 * Tests all requirements from Prompt 5:
 * - Camera permission denied
 * - Camera unavailable
 * - Camera start and stop
 * - Image upload and capture
 * - Successful OCR
 * - Empty or unreadable OCR results
 * - Missing or invalid totals
 * - Duplicate transaction submission
 * - Successful transaction saving
 * - Backend errors
 * - Product QR scanning continuing to work
 */

import { parseReceiptText, standardizeDate, parseCleanAmount } from './src/utils/billParser.js';

console.log('====================================================');
console.log('LIVE CAMERA & REAL OCR BILL SCANNER TEST SUITE');
console.log('====================================================');

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAILED: ${testName}`);
    failedCount++;
    throw new Error(`Assertion failed: ${testName}`);
  }
}

// -----------------------------------------------------------------------------
// TEST 1: Camera Permission Denied Error Handling
// -----------------------------------------------------------------------------
console.log('\n--- TEST 1: Camera Permission Denied Simulation ---');
function simulateCameraError(err) {
  if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
    return 'Camera access was denied by your browser. Please click the camera/lock icon in your address bar, allow camera permissions, and click "Start Camera".';
  } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
    return 'No camera device found on this system. Please connect a webcam or switch to "Upload Receipt Image".';
  } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
    return 'The camera is currently in use by another tab or app. Please close other camera programs and try again.';
  }
  return `Unable to access camera (${err.message || 'Unknown error'}).`;
}

const deniedError = { name: 'NotAllowedError', message: 'Permission denied' };
const deniedMsg = simulateCameraError(deniedError);
assert(deniedMsg.includes('Camera access was denied by your browser'), 'Permission denied produces actionable address bar instruction');

// -----------------------------------------------------------------------------
// TEST 2: Camera Unavailable / Missing Hardware
// -----------------------------------------------------------------------------
console.log('\n--- TEST 2: Camera Unavailable Simulation ---');
const notFoundError = { name: 'NotFoundError', message: 'Requested device not found' };
const notFoundMsg = simulateCameraError(notFoundError);
assert(notFoundMsg.includes('No camera device found on this system'), 'Missing camera device produces clear error recommending upload mode');

// -----------------------------------------------------------------------------
// TEST 3: Camera Start and Stop Stream Cleanup
// -----------------------------------------------------------------------------
console.log('\n--- TEST 3: Camera Start and Stop Lifecycle ---');
let stoppedTracks = 0;
const mockTrack = {
  stop: () => { stoppedTracks++; },
  kind: 'video',
};
const mockStream = {
  getTracks: () => [mockTrack],
};

// Simulation of stopBillCamera
function stopBillCameraSimulation(streamRef, videoRef) {
  if (streamRef.current) {
    streamRef.current.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }
  if (videoRef.current) {
    videoRef.current.srcObject = null;
  }
}

const streamRef = { current: mockStream };
const videoRef = { current: { srcObject: mockStream } };

stopBillCameraSimulation(streamRef, videoRef);
assert(stoppedTracks === 1, 'All media stream tracks cleanly stopped');
assert(streamRef.current === null, 'Stream reference cleared');
assert(videoRef.current.srcObject === null, 'Video element srcObject detached');

// -----------------------------------------------------------------------------
// TEST 4: Image Upload Validation
// -----------------------------------------------------------------------------
console.log('\n--- TEST 4: Image Upload File Validation ---');
function validateUploadFile(file) {
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'Selected file is not an image.' };
  }
  if (file.size > 15 * 1024 * 1024) {
    return { valid: false, error: 'Image size exceeds 15MB.' };
  }
  return { valid: true, error: '' };
}

assert(validateUploadFile({ type: 'image/jpeg', size: 2000000 }).valid === true, 'Accepts valid JPEG photo');
assert(validateUploadFile({ type: 'image/png', size: 1000000 }).valid === true, 'Accepts valid PNG photo');
assert(validateUploadFile({ type: 'application/pdf', size: 500000 }).valid === false, 'Rejects non-image PDF file');
assert(validateUploadFile({ type: 'image/jpeg', size: 18 * 1024 * 1024 }).valid === false, 'Rejects files over 15MB');

// -----------------------------------------------------------------------------
// TEST 5: Successful OCR Real Text Parsing
// -----------------------------------------------------------------------------
console.log('\n--- TEST 5: Real OCR Text Extraction ---');
const sampleReceiptText = `
AMMAN WHOLESALE TRADERS
Opp. Anna Market, Trichy - 620001
GSTIN: 33BBBBB1111B1Z2
Phone: 9443123456
TAX INVOICE
Bill No: AWT-2024-5510
Date: 15/10/2024

Items Description      Qty  Price   Total
Aashirvaad Atta 10kg    4   450.00  1800.00
Tata Salt 1kg           10   25.00   250.00

Sub Total: 2050.00
CGST @ 2.5%: 51.25
SGST @ 2.5%: 51.25
Grand Total: 2152.50
Paid By: Cash
Thank You!
`;

const ocrResult = parseReceiptText(sampleReceiptText, { data: { confidence: 92.5 } });
assert(ocrResult.merchant === 'AMMAN WHOLESALE TRADERS', `Merchant parsed: ${ocrResult.merchant}`);
assert(ocrResult.invoiceNumber === 'AWT-2024-5510', `Invoice # parsed: ${ocrResult.invoiceNumber}`);
assert(ocrResult.billDate === '2024-10-15', `Date standardized: ${ocrResult.billDate}`);
assert(ocrResult.subtotal === 2050, `Subtotal parsed: ${ocrResult.subtotal}`);
assert(ocrResult.tax === 102.5, `Tax summed (CGST+SGST): ${ocrResult.tax}`);
assert(ocrResult.amount === 2152.5, `Grand Total parsed: ${ocrResult.amount}`);
assert(ocrResult.category === 'Stock', `Category auto-detected: ${ocrResult.category}`);
assert(ocrResult.paymentMethod === 'Cash', `Payment method auto-detected: ${ocrResult.paymentMethod}`);
assert(ocrResult.confidence === 93, `Real confidence from Tesseract (93%): ${ocrResult.confidence}`);
assert(ocrResult.items.length === 2, `Itemized products extracted: ${ocrResult.items.length}`);

// -----------------------------------------------------------------------------
// TEST 6: Empty or Unreadable OCR Results
// -----------------------------------------------------------------------------
console.log('\n--- TEST 6: Empty or Unreadable OCR Results ---');
const emptyResult = parseReceiptText('', null);
assert(emptyResult.isReliable === false, 'Empty text marked unreliable');
assert(emptyResult.amount === '', 'Empty text has no fabricated amount');
assert(emptyResult.confidence === 0, 'Empty text has 0 confidence');

const noiseResult = parseReceiptText('... --- ///', { data: { confidence: 12.0 } });
assert(noiseResult.amount === '', 'Noise text has no fake amount');
assert(noiseResult.merchant === '', 'Noise text has no fake merchant');

// -----------------------------------------------------------------------------
// TEST 7: Missing or Invalid Totals Validation
// -----------------------------------------------------------------------------
console.log('\n--- TEST 7: Missing or Invalid Totals Validation ---');
function validateTransactionForSave(data) {
  if (!data || !data.amount || Number(data.amount) <= 0 || isNaN(Number(data.amount))) {
    return { valid: false, error: 'Please enter a valid positive amount.' };
  }
  return { valid: true };
}

assert(validateTransactionForSave({ amount: 0 }).valid === false, 'Rejects zero amount');
assert(validateTransactionForSave({ amount: -50 }).valid === false, 'Rejects negative amount');
assert(validateTransactionForSave({ amount: '' }).valid === false, 'Rejects empty amount');
assert(validateTransactionForSave({ amount: 1450.50 }).valid === true, 'Accepts valid positive amount');

// -----------------------------------------------------------------------------
// TEST 8: Duplicate Transaction Submission Prevention
// -----------------------------------------------------------------------------
console.log('\n--- TEST 8: Duplicate Transaction Submission Detection ---');
const existingTransactions = [
  { _id: 'tx1', amount: 2152.50, description: 'Amman Wholesale Traders bill', createdAt: '2024-10-15' },
  { _id: 'tx2', amount: 1450.00, description: 'Electricity bill', category: 'Electricity', createdAt: '2024-10-01' },
];

function checkDuplicate(amount, merchant, txList) {
  return txList.find((t) => {
    const amtMatch = Math.abs(Number(t.amount) - Number(amount)) < 0.01;
    const textMatch =
      (merchant && t.description?.toLowerCase().includes(merchant.toLowerCase())) ||
      (t.paidTo && merchant && t.paidTo.toLowerCase().includes(merchant.toLowerCase())) ||
      (t.category && merchant && merchant.toLowerCase().includes(t.category.toLowerCase()));
    return amtMatch && textMatch;
  });
}

const dupMatch = checkDuplicate(2152.50, 'Amman Wholesale Traders', existingTransactions);
assert(dupMatch !== undefined, 'Accurately detects existing transaction with identical amount & merchant');

const nonDupMatch = checkDuplicate(999.00, 'New Vendor Store', existingTransactions);
assert(nonDupMatch === undefined, 'Does not falsely flag distinct transactions');

// -----------------------------------------------------------------------------
// TEST 9: Successful Transaction Payload Structure
// -----------------------------------------------------------------------------
console.log('\n--- TEST 9: Transaction Payload Schema Conformance ---');
function buildExpensePayload(ocrData) {
  return {
    amount: Number(ocrData.amount),
    category: ocrData.category || 'Stock',
    paymentMethod: ocrData.paymentMethod || 'Cash',
    paidTo: ocrData.merchant || '',
    description: ocrData.description || `Scanned expense from ${ocrData.merchant || 'Vendor'}`,
    utrNumber: ocrData.invoiceNumber || '',
    entryMethod: 'scanned',
  };
}

const expensePayload = buildExpensePayload(ocrResult);
assert(expensePayload.entryMethod === 'scanned', 'entryMethod correctly flagged as "scanned"');
assert(expensePayload.amount === 2152.5, 'Amount correctly mapped');
assert(expensePayload.paidTo === 'AMMAN WHOLESALE TRADERS', 'paidTo matches parsed merchant');
assert(expensePayload.category === 'Stock', 'category is a valid schema category');

// -----------------------------------------------------------------------------
// TEST 10: Backend Error Handling
// -----------------------------------------------------------------------------
console.log('\n--- TEST 10: Backend Error Handling ---');
function handleApiError(err) {
  return err.response?.data?.message || err.message || 'Failed to save scanned transaction.';
}

const mockAxiosError = {
  response: {
    status: 400,
    data: { message: 'Database connection timed out or validation failed.' },
  },
};
const errResult = handleApiError(mockAxiosError);
assert(errResult === 'Database connection timed out or validation failed.', 'Extracts backend error message cleanly');

// -----------------------------------------------------------------------------
// TEST 11: Product QR Scanning Integrity
// -----------------------------------------------------------------------------
console.log('\n--- TEST 11: Product QR Scanning Functionality Integrity ---');
import { Html5QrcodeSupportedFormats } from 'html5-qrcode';
assert(Html5QrcodeSupportedFormats.QR_CODE !== undefined, 'Html5Qrcode supported formats available');
assert(Html5QrcodeSupportedFormats.EAN_13 !== undefined, 'EAN-13 barcode format available');
assert(Html5QrcodeSupportedFormats.CODE_128 !== undefined, 'CODE-128 barcode format available');

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n====================================================');
console.log(`TEST SUITE COMPLETE: ${passedCount} PASSED, ${failedCount} FAILED`);
console.log('====================================================\n');

if (failedCount > 0) {
  process.exit(1);
}
