export const translations = {
  en: {
    appTitle: "Smart Business Manager",
    voiceHelp: "Voice Help",
    micActive: "Listening...",
    speakBtn: "Speak",

    // Sidebar items
    navDashboard: "Dashboard",
    navSales: "Sales",
    navExpenses: "Expenses",
    navScanBill: "Scan Bill",
    navTransactions: "Transactions",
    navProfitLoss: "Profit & Loss",
    navVoiceHelp: "Voice Help",
    navSettings: "Settings",
    navUpiApp: "UPI App Simulator",

    // Dashboard Cards
    totalSales: "TOTAL SALES",
    totalSpent: "TOTAL SPENT",
    currentBalance: "CURRENT BALANCE",
    profitLoss: "PROFIT / LOSS",
    profit: "PROFIT",
    loss: "LOSS",
    neutral: "BALANCED",

    // Sales Page Sections
    addCashSale: "ADD CASH SALE",
    saveCashSale: "SAVE CASH SALE",
    connectedPayments: "CONNECTED PAYMENTS",
    automaticPayments: "AUTOMATIC PAYMENTS",
    upiStatus: "UPI Payments",
    cardStatus: "Card Payments",
    connected: "Connected",
    notConnected: "Not Connected",
    manualOnlyNotice: "UPI & Card payments are automatically received and verified via connected payment provider webhooks.",
    noAutomaticPayments: "No automatic UPI/Card payments recorded yet.",

    // Payment Setup (Settings)
    paymentConnectionsSetup: "PAYMENT SETUP",
    selectProvider: "Select Payment Provider",
    merchantVpaLabel: "Merchant UPI ID / VPA",
    connectUpi: "CONNECT UPI",
    connectCard: "CONNECT CARD PAYMENT PROVIDER",
    developerTestMode: "DEVELOPER / TEST MODE",
    testPaymentNotReal: "TEST PAYMENT — NOT REAL MONEY",
    simulateUpiTest: "Execute Test UPI Webhook (₹1,000)",
    simulateCardTest: "Execute Test Card Webhook (₹2,500)",

    // Dashboard sections
    salesOverview: "Sales Overview",
    expenseOverview: "Expense Overview",
    recentTransactions: "Recent Transactions",
    enterSaleManually: "ENTER SALE MANUALLY",
    enterExpenseManually: "ENTER EXPENSE MANUALLY",
    scanBillReceipt: "SCAN BILL / RECEIPT",
    viewAll: "View All",
    noTransactions: "No transactions recorded yet.",

    // Form labels
    saleAmountQuestion: "Amount *",
    paymentMethodQuestion: "Payment Method",
    optionalDescription: "Description / Item (Optional)",
    expenseAmountQuestion: "Amount *",
    expenseCategoryQuestion: "Category *",
    saveExpense: "SAVE EXPENSE",
    merchantName: "Merchant Name",

    // Payment Methods
    cash: "Cash",
    upi: "UPI",
    card: "Card",

    // Categories
    categoryStock: "Stock",
    categoryRent: "Rent",
    categoryElectricity: "Electricity",
    categorySalary: "Staff Salary",
    categoryTransport: "Transport",
    categoryOther: "Other",

    // Scan Bill
    scanUploadTitle: "SCAN / UPLOAD BILL",
    scanUploadSubtitle: "Upload or capture a receipt image to auto-detect transaction details.",
    selectBillImage: "Choose Bill Image",
    processingBill: "Scanning receipt with OCR...",
    receiptDetected: "RECEIPT DETECTED",
    confirmAndSave: "CONFIRM & SAVE",
    cancel: "CANCEL",
    type: "Type",
    source: "Source",
    status: "Status",
    entryMethod: "Entry Method",
    manual: "Manual",
    automatic: "Automatic",
    scanned: "Scanned",

    // Status Badges
    recorded: "Recorded",
    success: "Success",
    pending: "Pending",
    failed: "Failed",
    refunded: "Refunded",

    // Transactions Table
    date: "Date & Time",
    descriptionCategory: "Description / Category",
    paymentMethodLabel: "Payment Method",
    amount: "Amount",
    action: "Action",
    delete: "Delete",

    // Filters
    filterByType: "Type",
    filterByEntry: "Source",
    filterByTime: "Time Period",
    all: "All",
    sales: "Sales",
    expenses: "Expenses",
    today: "Today",
    thisWeek: "This Week",
    thisMonth: "This Month",
    thisYear: "This Year",
    custom: "Custom Range",

    // Profit & Loss
    period: "Period",
    netProfit: "NET PROFIT",
    netLoss: "NET LOSS",
    clickToSeeBreakdown: "Click to see detailed breakdown",
    salesBreakdown: "Sales Breakdown (By Payment Method)",
    expenseBreakdown: "Expense Breakdown (By Category)",
    close: "Close",

    // Alerts
    saleAddedSuccess: "Cash sale added successfully",
    expenseAddedSuccess: "Expense added successfully",
    scannedAddedSuccess: "Scanned transaction saved successfully",
    enterAmountError: "Please enter an amount greater than 0.",

    // Voice Expts
    voiceExplanationDashboard: "This is your dashboard. Here you can see total sales, total spent, current balance, and net profit or loss.",
    voiceExplanationSales: "Add cash sales manually or view automatic UPI and Card transactions.",
    voiceExplanationExpenses: "Enter how much you spent and choose the expense category.",
    voiceExplanationScan: "Upload a receipt photo to scan details, review the extracted values, and click Confirm and Save.",
    voiceExplanationTransactions: "Here you can see all your manual, automatic, and scanned transactions.",
    voiceExplanationProfitLoss: "Choose today, this week, this month, or this year to see your profit or loss.",
  },
  ta: {
    appTitle: "ஸ்மார்ட் பிசினஸ் மேனேஜர்",
    voiceHelp: "குரல் உதவி",
    micActive: "கவனித்துக் கொண்டிருக்கிறது...",
    speakBtn: "பேசு",

    // Sidebar items
    navDashboard: "டேஷ்போர்டு",
    navSales: "விற்பனை",
    navExpenses: "செலவுகள்",
    navScanBill: "பில் ஸ்கேன்",
    navTransactions: "பரிவர்த்தனைகள்",
    navProfitLoss: "லாபம் & நஷ்டம்",
    navVoiceHelp: "குரல் உதவி",
    navSettings: "அமைப்புகள்",
    navUpiApp: "UPI ஆப் சிமுலேட்டர்",

    // Dashboard Cards
    totalSales: "மொத்த விற்பனை",
    totalSpent: "மொத்த செலவு",
    currentBalance: "தற்போதைய இருப்பு",
    profitLoss: "லாபம் / நஷ்டம்",
    profit: "லாபம்",
    loss: "நஷ்டம்",
    neutral: "சமநிலை",

    // Sales Page Sections
    addCashSale: "விற்பனை சேர்க்க (ரொக்கம்)",
    saveCashSale: "ரொக்க விற்பனையை சேமிக்கவும்",
    connectedPayments: "இணைக்கப்பட்ட பண அமைப்புகள்",
    automaticPayments: "தானியங்கி பரிவர்த்தனைகள்",
    upiStatus: "UPI செலுத்துதல்கள்",
    cardStatus: "கார்டு செலுத்துதல்கள்",
    connected: "இணைக்கப்பட்டது",
    notConnected: "இணைக்கப்படவில்லை",
    manualOnlyNotice: "UPI மற்றும் கார்டு விற்பனைகள் தானாகவே சரிபார்க்கப்பட்டு சேர்க்கப்படும்.",
    noAutomaticPayments: "தானியங்கி UPI/கார்டு பரிவர்த்தனைகள் இதுவரை இல்லை.",

    // Payment Setup (Settings)
    paymentConnectionsSetup: "பண அமைப்பு அமைப்புகள்",
    selectProvider: "பணச் சேவை நிறுவனத்தைத் தேர்ந்தெடுக்கவும்",
    merchantVpaLabel: "வியாபாரி UPI முகவரி (VPA)",
    connectUpi: "UPI இணைக்கவும்",
    connectCard: "கார்டு பண அமைப்பை இணைக்கவும்",
    developerTestMode: "டெவலப்பர் / சோதனை முறை",
    testPaymentNotReal: "சோதனை பரிவர்த்தனை — உண்மையான பணம் அல்ல",
    simulateUpiTest: "சோதனை UPI பரிவர்த்தனை (₹1,000)",
    simulateCardTest: "சோதனை கார்டு பரிவர்த்தனை (₹2,500)",

    // Dashboard sections
    salesOverview: "விற்பனை மேலோட்டம்",
    expenseOverview: "செலவு மேலோட்டம்",
    recentTransactions: "சமீபத்திய பரிவர்த்தனைகள்",
    enterSaleManually: "கைமுறையாக விற்பனை சேர்க்க",
    enterExpenseManually: "கைமுறையாக செலவு சேர்க்க",
    scanBillReceipt: "பில் / ரசீதை ஸ்கேன் செய்ய",
    viewAll: "அனைத்தையும் பார்",
    noTransactions: "இதுவரை பரிவர்த்தனைகள் பதிவு செய்யப்படவில்லை.",

    // Form labels
    saleAmountQuestion: "விற்பனை தொகை *",
    paymentMethodQuestion: "பணம் செலுத்தும் முறை",
    optionalDescription: "விளக்கம் (விருப்பப்பட்டால்)",
    expenseAmountQuestion: "செலவு தொகை *",
    expenseCategoryQuestion: "செலவு பிரிவு *",
    saveExpense: "செலவை சேமிக்கவும்",
    merchantName: "கடை / வியாபாரி பெயர்",

    // Payment Methods
    cash: "ரொக்கம் (Cash)",
    upi: "யுபிஐ (UPI)",
    card: "கார்டு (Card)",

    // Categories
    categoryStock: "பொருட்கள் (Stock)",
    categoryRent: "கடை வாடகை (Rent)",
    categoryElectricity: "மின்சாரம் (Electricity)",
    categorySalary: "சம்பளம் (Salary)",
    categoryTransport: "போக்குவரத்து (Transport)",
    categoryOther: "இதர செலவு (Other)",

    // Scan Bill
    scanUploadTitle: "பில் ஸ்கேன் / பதிவேற்றம்",
    scanUploadSubtitle: "பில் புகைப்படத்தைப் பதிவேற்றி விவரங்களை தானாகக் கண்டறியவும்.",
    selectBillImage: "பில் படம் தேர்ந்தெடுக்கவும்",
    processingBill: "பில் ஸ்கேன் செய்யப்படுகிறது...",
    receiptDetected: "ரசீது கண்டறியப்பட்டது",
    confirmAndSave: "உறுதிசெய்து சேமிக்கவும்",
    cancel: "ரத்து செய்",
    type: "வகை",
    source: "மூலம்",
    status: "நிலை",
    entryMethod: "பதிவு முறை",
    manual: "கைமுறை (Manual)",
    automatic: "தானியங்கி (Automatic)",
    scanned: "ஸ்கேன் செய்யப்பட்டது (Scanned)",

    // Status Badges
    recorded: "பதிவு செய்யப்பட்டது",
    success: "வெற்றி",
    pending: "நிலுவையில்",
    failed: "தோல்வி",
    refunded: "திரும்பப் பெறப்பட்டது",

    // Transactions Table
    date: "தேதி & நேரம்",
    descriptionCategory: "விளக்கம் / பிரிவு",
    paymentMethodLabel: "பண முறை",
    amount: "தொகை",
    action: "செயல்",
    delete: "நீக்கு",

    // Filters
    filterByType: "வகை",
    filterByEntry: "மூலம்",
    filterByTime: "காலம்",
    all: "அனைத்தும்",
    sales: "விற்பனை",
    expenses: "செலவுகள்",
    today: "இன்று",
    thisWeek: "இந்த வாரம்",
    thisMonth: "இந்த மாதம்",
    thisYear: "இந்த ஆண்டு",
    custom: "தேர்ந்தெடுக்கப்பட்ட காலம்",

    // Profit & Loss
    period: "காலகட்டம்",
    netProfit: "நிகர லாபம்",
    netLoss: "நிகர நஷ்டம்",
    clickToSeeBreakdown: "விரிவான பட்டியலைக் காண கிளிக் செய்யவும்",
    salesBreakdown: "விற்பனை பிரிவு (பண முறைப்படி)",
    expenseBreakdown: "செலவு பிரிவு (வகைப்படி)",
    close: "மூடு",

    // Alerts
    saleAddedSuccess: "ரொக்க விற்பனை வெற்றிகரமாக சேர்க்கப்பட்டது",
    expenseAddedSuccess: "செலவு வெற்றிகரமாக சேர்க்கப்பட்டது",
    scannedAddedSuccess: "ஸ்கேன் செய்த பரிவர்த்தனை வெற்றிகரமாக சேமிக்கப்பட்டது",
    enterAmountError: "தயவுசெய்து சரியான தொகையை உள்ளிடவும்.",

    // Voice Expts
    voiceExplanationDashboard: "இது உங்கள் டேஷ்போர்டு. இங்கு மொத்த விற்பனை, செலவு, இருப்பு மற்றும் லாப நஷ்டத்தைப் பார்க்கலாம்.",
    voiceExplanationSales: "ரொக்க விற்பனையை நேரடியாகச் சேர்க்கலாம் அல்லது தானியங்கி யுபிஐ/கார்டு விற்பனைகளைப் பார்க்கலாம்.",
    voiceExplanationExpenses: "எவ்வளவு செலவு செய்தீர்கள் மற்றும் செலவுப் பிரிவைத் தேர்ந்தெடுக்கவும்.",
    voiceExplanationScan: "பில் புகைப்படத்தைப் பதிவேற்றி விவரங்களைச் சரிபார்த்து உறுதிசெய்து சேமிக்கவும்.",
    voiceExplanationTransactions: "இங்கு உங்கள் அனைத்து விற்பனை மற்றும் செலவுகளையும் ஒரே இடத்தில் பார்க்கலாம்.",
    voiceExplanationProfitLoss: "இன்று, இந்த வாரம், இந்த மாதம் அல்லது இந்த ஆண்டின் லாப நஷ்டத்தைப் பார்க்கலாம்.",
  },
};
