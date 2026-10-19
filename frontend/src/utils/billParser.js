/**
 * Real Receipt & Invoice Parser
 * Parses OCR recognized text and extracts financial, vendor, and line-item details.
 * Does NOT hardcode sample data or fabricate confidence scores.
 */

// Common receipt header lines that shouldn't be treated as merchant names
const HEADER_NOISE_TERMS = [
  'tax invoice',
  'retail invoice',
  'commercial invoice',
  'invoice',
  'bill of supply',
  'cash memo',
  'cash bill',
  'receipt',
  'sales receipt',
  'original for recipient',
  'duplicate for supplier',
  'customer copy',
  'store copy',
  'estimate',
  'quotation',
  'order receipt',
  'welcome',
  'thank you',
  'visit again',
  'gst invoice',
  'bill receipt',
];

// Words indicating a date line
const DATE_LINE_REGEX = /(?:date|dt|dated)[\s#.:\-_]*([0-3]?[0-9][\/\-.][0-1]?[0-9][\/\-.](?:20)?[0-9]{2})/i;
const STANDALONE_DATE_REGEX = /\b([0-3]?[0-9])[\/\-.]([0-1]?[0-9])[\/\-.](20\d{2}|\d{2})\b/;
const MONTH_NAMES = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
};

/**
 * Standardize various date formats into YYYY-MM-DD for form input
 */
export const standardizeDate = (dateStr) => {
  if (!dateStr) return new Date().toISOString().split('T')[0];

  try {
    // 1. Text date like 15-Aug-2024 or 15 Aug 2024
    const textMonthMatch = dateStr.match(/\b([0-3]?[0-9])[\s\-.]([a-zA-Z]{3})[a-zA-Z]*[\s\-.](20\d{2}|\d{2})\b/);
    if (textMonthMatch) {
      const day = textMonthMatch[1].padStart(2, '0');
      const monKey = textMonthMatch[2].toLowerCase();
      const month = MONTH_NAMES[monKey] || '01';
      let year = textMonthMatch[3];
      if (year.length === 2) year = '20' + year;
      return `${year}-${month}-${day}`;
    }

    // 2. Numeric date like 25/08/2024 or 2024-08-25
    const numMatch = dateStr.match(/\b([0-3]?[0-9])[\/\-.]([0-1]?[0-9])[\/\-.](20\d{2}|\d{2})\b/);
    if (numMatch) {
      let part1 = parseInt(numMatch[1], 10);
      let part2 = parseInt(numMatch[2], 10);
      let year = numMatch[3];
      if (year.length === 2) year = '20' + year;

      let day, month;
      if (part1 > 12 && part2 <= 12) {
        day = String(part1).padStart(2, '0');
        month = String(part2).padStart(2, '0');
      } else if (part2 > 12 && part1 <= 12) {
        month = String(part1).padStart(2, '0');
        day = String(part2).padStart(2, '0');
      } else {
        // Default DD/MM/YYYY
        day = String(part1).padStart(2, '0');
        month = String(part2).padStart(2, '0');
      }
      return `${year}-${month}-${day}`;
    }

    // 3. ISO YYYY-MM-DD
    const isoMatch = dateStr.match(/\b(20\d{2})[\/\-.]([0-1]?[0-9])[\/\-.]([0-3]?[0-9])\b/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
    }
  } catch {
    // ignore parse error and fall back
  }

  return new Date().toISOString().split('T')[0];
};

/**
 * Clean monetary string to float
 */
export const parseCleanAmount = (raw) => {
  if (!raw) return 0;
  // Strip currency symbols and letters, keeping digits, dots, commas
  const cleaned = String(raw).replace(/[^0-9.,]/g, '').trim();
  if (!cleaned) return 0;

  // Handle Indian number formatting with commas e.g. 1,45,200.50 or 14,250.00
  const normalized = cleaned.replace(/,/g, '');
  const num = parseFloat(normalized);
  return isNaN(num) ? 0 : num;
};

/**
 * Checks if a string looks like a phone number, PIN code, or GSTIN
 * to prevent accidentally picking them as amounts.
 */
const isNonFinancialIdentifier = (text) => {
  if (!text) return false;
  const digitsOnly = text.replace(/[^0-9]/g, '');

  // 10-digit phone number (Indian mobile usually 6-9 leading)
  if (digitsOnly.length === 10 && /^[6-9]/.test(digitsOnly)) return true;

  // 12-digit Aadhaar or phone with country code +91
  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) return true;

  // 6-digit PIN code (e.g., 600001, 110001)
  if (digitsOnly.length === 6 && /^[1-9]/.test(digitsOnly)) {
    // If it's on a line mentioning Pin / Postal / Code or no decimals
    if (/pin\s*code|pincode|postal/i.test(text)) return true;
  }

  // 15-character GSTIN
  if (/\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z0-9]{3}\b/i.test(text)) return true;

  return false;
};

/**
 * Main OCR Text Parser
 * @param {string} rawText Full OCR text recognized from image
 * @param {object} tesseractData Optional result object from tesseract.js
 * @returns {object} Extracted financial fields, items, and verification notes
 */
export const parseReceiptText = (rawText, tesseractData = null) => {
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return {
      merchant: '',
      invoiceNumber: '',
      billDate: new Date().toISOString().split('T')[0],
      amount: '',
      subtotal: '',
      tax: '',
      discount: '',
      type: 'Expense',
      category: 'Stock',
      paymentMethod: 'Cash',
      description: '',
      items: [],
      ocrRawText: '',
      confidence: 0,
      validationNotes: ['No text detected in the provided image.'],
      isReliable: false,
    };
  }

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // 1. Calculate Real Confidence from Tesseract
  let calculatedConfidence = 0;
  if (tesseractData && tesseractData.data && typeof tesseractData.data.confidence === 'number') {
    calculatedConfidence = Math.round(tesseractData.data.confidence);
  }

  // 2. Extract Merchant / Vendor Name
  let merchant = '';
  // Inspect the first 6 non-empty lines for prominent merchant title
  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    // Skip headers and disclaimers
    const isNoise = HEADER_NOISE_TERMS.some((term) => lower.includes(term));
    if (isNoise) continue;

    // Skip phone, website, gst lines
    if (/ph(?:one)?|mob(?:ile)?|tel|www\.|https?:|email|gstin|gst\s*no/i.test(lower)) continue;

    // Skip address lines
    if (/^(no|plot|flat|door|street|road|nagar|opp|near|po\s*box)\b/i.test(lower)) continue;
    if (/\b\d{6}\b/.test(line)) continue; // pincode line

    // Must contain letters (not just symbols or dates)
    const letterCount = (line.match(/[a-zA-Z]/g) || []).length;
    if (letterCount >= 3) {
      // Clean leading/trailing punctuation
      merchant = line.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9)]+$/g, '').trim();
      break;
    }
  }

  // 3. Extract Invoice / Receipt / Bill Number
  let invoiceNumber = '';
  for (const line of lines) {
    // Skip plain header lines like "TAX INVOICE" without a number
    if (/^(tax\s+invoice|retail\s+invoice|invoice)$/i.test(line.trim())) continue;
    const invMatch = line.match(
      /(?:invoice\s*(?:no|num|number|#)?|inv\s*(?:no|num|#)?|bill\s*(?:no|num|#)?|receipt\s*(?:no|num|#)?|rcpt\s*#?|memo\s*(?:no|#)?)[\s#.:\-_/]+([A-Za-z0-9\-_/]{2,24})/i
    );
    if (invMatch && invMatch[1]) {
      const candidate = invMatch[1].trim();
      if (!/^(date|tax|invoice|cash|upi|card|total|time|memo|bill|copy|due)$/i.test(candidate)) {
        invoiceNumber = candidate;
        break;
      }
    }
  }

  // 4. Extract Date
  let billDate = new Date().toISOString().split('T')[0];
  const dateLineMatch = rawText.match(DATE_LINE_REGEX);
  if (dateLineMatch && dateLineMatch[1]) {
    billDate = standardizeDate(dateLineMatch[1]);
  } else {
    const standaloneMatch = rawText.match(STANDALONE_DATE_REGEX);
    if (standaloneMatch && standaloneMatch[0]) {
      billDate = standardizeDate(standaloneMatch[0]);
    }
  }

  // 5. Extract Financial Figures (Total, Subtotal, Tax, Discount)
  let totalAmount = 0;
  let subtotalAmount = 0;
  let taxAmount = 0;
  let discountAmount = 0;
  const validationNotes = [];

  // Regex patterns for line-matching
  const totalKeywords = /(?:grand\s*total|net\s*total|total\s*amount|net\s*payable|amount\s*payable|final\s*amount|total\s*due|balance\s*due|bill\s*amount|total\s*inr)\s*[:=]?\s*([₹Rs.\s]*[0-9,]+(?:\.[0-9]{1,2})?)/i;
  const subtotalKeywords = /(?:sub\s*total|subtotal|taxable\s*value|taxable\s*amount|base\s*amount|items\s*total)\s*[:=]?\s*([₹Rs.\s]*[0-9,]+(?:\.[0-9]{1,2})?)/i;
  const taxKeywords = /(?:cgst|sgst|igst|gst|tax|vat)\s*(?:\([^)]*\)|@\s*[0-9.]+%)?\s*[:=]?\s*([₹Rs.\s]*[0-9,]+(?:\.[0-9]{1,2})?)/i;
  const discountKeywords = /(?:discount|disc|savings|rebate|less)\s*[:=]?\s*([₹Rs.\s]*[0-9,]+(?:\.[0-9]{1,2})?)/i;

  // Line-by-line inspection
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check Subtotal
    if (!subtotalAmount && subtotalKeywords.test(line)) {
      const match = line.match(subtotalKeywords);
      if (match && match[1]) {
        const val = parseCleanAmount(match[1]);
        if (val > 0 && !isNonFinancialIdentifier(match[1])) {
          subtotalAmount = val;
        }
      }
    }

    // Check Tax (can sum up multiple tax components like CGST + SGST)
    if (taxKeywords.test(line) && !line.toLowerCase().includes('tax invoice')) {
      const match = line.match(taxKeywords);
      if (match && match[1]) {
        const val = parseCleanAmount(match[1]);
        if (val > 0 && !isNonFinancialIdentifier(match[1])) {
          taxAmount += val;
        }
      }
    }

    // Check Discount
    if (!discountAmount && discountKeywords.test(line)) {
      const match = line.match(discountKeywords);
      if (match && match[1]) {
        const val = parseCleanAmount(match[1]);
        if (val > 0 && !isNonFinancialIdentifier(match[1])) {
          discountAmount = val;
        }
      }
    }

    // Check Explicit Grand/Net Total
    if (!totalAmount && totalKeywords.test(line)) {
      const match = line.match(totalKeywords);
      if (match && match[1]) {
        const val = parseCleanAmount(match[1]);
        if (val > 0 && !isNonFinancialIdentifier(match[1])) {
          totalAmount = val;
        }
      }
    }
  }

  // Fallback for simple "TOTAL:" lines (avoiding "Total Qty" or "Total Items")
  if (!totalAmount) {
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (/\btotal\b/i.test(line) && !/total\s*(qty|quantity|items|pieces|pcs|count)/i.test(line)) {
        // Extract rightmost monetary figure on this line
        const numMatches = line.match(/[0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})|[0-9]+(?:\.[0-9]{1,2})/g);
        if (numMatches && numMatches.length > 0) {
          const candidate = numMatches[numMatches.length - 1];
          const val = parseCleanAmount(candidate);
          if (val > 0 && !isNonFinancialIdentifier(candidate)) {
            totalAmount = val;
            break;
          }
        }
      }
    }
  }

  // Cross-check mathematical consistency if subtotal & tax were detected
  if (subtotalAmount > 0) {
    const computedTotal = Math.round((subtotalAmount + taxAmount - discountAmount) * 100) / 100;
    if (totalAmount > 0) {
      if (Math.abs(totalAmount - computedTotal) <= 1.0) {
        validationNotes.push(`Verified: Subtotal (₹${subtotalAmount}) + Tax (₹${taxAmount}) - Discount (₹${discountAmount}) aligns with Total (₹${totalAmount}).`);
      } else {
        validationNotes.push(`Note: Scanned total ₹${totalAmount} differs slightly from computed sum (₹${computedTotal}). Please review.`);
      }
    } else {
      totalAmount = computedTotal;
      validationNotes.push(`Total calculated from Subtotal (₹${subtotalAmount}) + Tax (₹${taxAmount}).`);
    }
  }

  // Fallback if no total was identified by keywords: scan valid monetary values
  if (!totalAmount) {
    const candidateAmounts = [];
    for (let i = Math.floor(lines.length * 0.4); i < lines.length; i++) {
      const line = lines[i];
      // Skip phone / GST lines
      if (isNonFinancialIdentifier(line)) continue;

      const matches = line.match(/[0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})|[0-9]+(?:\.[0-9]{2})/g);
      if (matches) {
        matches.forEach((m) => {
          const val = parseCleanAmount(m);
          if (val > 1 && val < 5000000 && !isNonFinancialIdentifier(m)) {
            candidateAmounts.push(val);
          }
        });
      }
    }
    if (candidateAmounts.length > 0) {
      // The largest valid amount in the bottom half of a receipt is usually the total
      totalAmount = Math.max(...candidateAmounts);
      validationNotes.push(`Total inferred from highest monetary amount on receipt (₹${totalAmount}). Please verify.`);
    }
  }

  // 6. Infer Category & Transaction Type
  const lowerAll = rawText.toLowerCase();
  let inferredType = 'Expense';
  let inferredCategory = 'Stock';
  let inferredPayment = 'Cash';

  // Type check: Sale vs Expense
  if (/sold\s*to|customer\s*name|customer\s*copy|counter\s*sale|sale\s*bill/i.test(lowerAll)) {
    inferredType = 'Sale';
  }

  // Category check
  if (/electricity|discom|kwh|units\s*consumed|meter\s*no|eb\s*bill|power\s*distribution/i.test(lowerAll)) {
    inferredCategory = 'Electricity';
    inferredType = 'Expense';
  } else if (/rent|rental|lease|premises\s*rent/i.test(lowerAll)) {
    inferredCategory = 'Rent';
    inferredType = 'Expense';
  } else if (/salary|wages|payroll|staff\s*pay/i.test(lowerAll)) {
    inferredCategory = 'Salary';
    inferredType = 'Expense';
  } else if (/transport|freight|courier|logistics|diesel|petrol|fuel|toll/i.test(lowerAll)) {
    inferredCategory = 'Transport';
    inferredType = 'Expense';
  } else if (/wholesale|distributor|traders|supplies|pvt\s*ltd|store/i.test(lowerAll)) {
    inferredCategory = 'Stock';
    inferredType = 'Expense';
  }

  // Payment method check
  if (/upi|gpay|google\s*pay|phonepe|paytm|bhim/i.test(lowerAll)) {
    inferredPayment = 'UPI';
  } else if (/card|visa|mastercard|rupay|debit|credit|pos\s*terminal/i.test(lowerAll)) {
    inferredPayment = 'Card';
  }

  // 7. Extract Itemized Line Items when identifiable
  const items = [];
  // Typical line item pattern: Description [Qty] [Rate] [Total]
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (totalKeywords.test(line) || subtotalKeywords.test(line) || taxKeywords.test(line)) continue;

    // Line matching format: words followed by qty and prices
    const itemMatch = line.match(/^([a-zA-Z0-9\s&()\-./]{3,35})\s+([0-9]{1,3})\s+([0-9.]+(?:\.[0-9]{1,2})?)\s+([0-9.]+(?:\.[0-9]{1,2})?)$/);
    if (itemMatch) {
      const name = itemMatch[1].trim();
      const qty = parseInt(itemMatch[2], 10) || 1;
      const rate = parseFloat(itemMatch[3]) || 0;
      const itemTotal = parseFloat(itemMatch[4]) || 0;
      if (name.length >= 3 && rate > 0) {
        items.push({ name, quantity: qty, unitPrice: rate, total: itemTotal });
      }
    }
  }

  const isReliable = totalAmount > 0 && merchant.length > 0;

  return {
    merchant: merchant || '',
    invoiceNumber: invoiceNumber || '',
    billDate,
    amount: totalAmount > 0 ? totalAmount : '',
    subtotal: subtotalAmount > 0 ? subtotalAmount : '',
    tax: taxAmount > 0 ? taxAmount : '',
    discount: discountAmount > 0 ? discountAmount : '',
    type: inferredType,
    category: inferredCategory,
    paymentMethod: inferredPayment,
    description: merchant
      ? `${inferredType === 'Sale' ? 'Sale invoice' : 'Expense bill'} from ${merchant}${invoiceNumber ? ` (#${invoiceNumber})` : ''}`
      : `Scanned receipt${invoiceNumber ? ` #${invoiceNumber}` : ''}`,
    items,
    ocrRawText: rawText,
    confidence: calculatedConfidence,
    validationNotes,
    isReliable,
  };
};
