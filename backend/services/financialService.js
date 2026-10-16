import Sale from '../models/Sale.js';
import Expense from '../models/Expense.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';

/**
 * Standard Financial Calculation Service
 * Single source of truth for:
 * - Sales Revenue
 * - Cost of Goods Sold (COGS)
 * - Operating Expenses
 * - Gross Profit & Net Profit / Loss
 * - Cash vs Digital Payment breakdowns
 * - Date Boundaries (Today, Yesterday, Week, Month, Year, Custom)
 * - Strict exclusion of test/sandbox transactions from business revenue
 */

/**
 * Computes exact start and end dates based on filter period
 */
export const getDateRange = (period = 'all', startDate = null, endDate = null) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  switch (period) {
    case 'today':
      return { start: startOfToday, end: endOfToday };

    case 'yesterday': {
      const startOfYesterday = new Date(startOfToday);
      startOfYesterday.setDate(startOfYesterday.getDate() - 1);
      const endOfYesterday = new Date(startOfYesterday);
      endOfYesterday.setHours(23, 59, 59, 999);
      return { start: startOfYesterday, end: endOfYesterday };
    }

    case 'week': {
      const startOfWeek = new Date(startOfToday);
      const day = startOfToday.getDay(); // 0 is Sunday
      const diff = startOfToday.getDate() - day + (day === 0 ? -6 : 1); // Monday start
      startOfWeek.setDate(diff);
      return { start: startOfWeek, end: endOfToday };
    }

    case 'month': {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return { start: startOfMonth, end: endOfToday };
    }

    case 'year': {
      const startOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      return { start: startOfYear, end: endOfToday };
    }

    case 'custom':
      if (startDate && endDate) {
        return {
          start: new Date(startDate),
          end: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
        };
      }
      return { start: null, end: null };

    case 'all':
    default:
      if (startDate && endDate) {
        return {
          start: new Date(startDate),
          end: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
        };
      }
      return { start: null, end: null };
  }
};

/**
 * Round monetary value safely to 2 decimal places
 */
export const roundMoney = (val) => {
  return Math.round((Number(val) || 0) * 100) / 100;
};

/**
 * Calculate comprehensive financial metrics for a specific user/shop
 */
export const calculateFinancialMetrics = async ({
  userId,
  period = 'all',
  startDate = null,
  endDate = null,
  includeTest = false,
}) => {
  if (!userId) {
    throw new Error('User ID is required for financial calculations.');
  }

  const { start, end } = getDateRange(period, startDate, endDate);

  // Build query filter
  const baseFilter = { userId };
  if (!includeTest) {
    baseFilter.isTest = { $ne: true };
  }

  if (start && end) {
    baseFilter.createdAt = { $gte: start, $lte: end };
  } else if (start) {
    baseFilter.createdAt = { $gte: start };
  }

  // Fetch Sales & Expenses concurrently
  const [sales, expenses] = await Promise.all([
    Sale.find(baseFilter).lean(),
    Expense.find(baseFilter).lean(),
  ]);

  // Filter Rule: Finalized/eligible sales only
  // Exclude pending verification, failed, and refunded payments
  const eligibleSales = sales.filter((s) => {
    if (s.verificationStatus === 'pending_verification') return false;
    if (['pending', 'failed', 'refunded'].includes(s.paymentStatus)) return false;
    return s.paymentStatus === 'success' || s.paymentStatus === 'recorded';
  });

  // Eligible expenses (exclude failed/refunded outflows)
  const eligibleExpenses = expenses.filter((e) => {
    if (['pending', 'failed', 'refunded'].includes(e.paymentStatus)) return false;
    return true;
  });

  // 1. Sales Revenue
  const totalSales = roundMoney(eligibleSales.reduce((sum, s) => sum + (s.amount || 0), 0));

  // 2. Cost of Goods Sold (COGS)
  let totalCogs = 0;
  for (const sale of eligibleSales) {
    if (sale.costOfGoodsSold && sale.costOfGoodsSold > 0) {
      totalCogs += sale.costOfGoodsSold;
    } else if (sale.items && sale.items.length > 0) {
      for (const item of sale.items) {
        totalCogs += (item.quantity || 1) * (item.costPrice || 0);
      }
    }
  }
  totalCogs = roundMoney(totalCogs);

  // 3. Operating Expenses
  const totalExpenses = roundMoney(eligibleExpenses.reduce((sum, e) => sum + (e.amount || 0), 0));

  // Expense breakdown by category
  const expensesByCategory = {
    stock: 0,
    rent: 0,
    electricity: 0,
    salary: 0,
    transport: 0,
    other: 0,
  };

  eligibleExpenses.forEach((e) => {
    const cat = (e.category || 'Other').toLowerCase();
    if (expensesByCategory[cat] !== undefined) {
      expensesByCategory[cat] = roundMoney(expensesByCategory[cat] + (e.amount || 0));
    } else {
      expensesByCategory.other = roundMoney(expensesByCategory.other + (e.amount || 0));
    }
  });

  // 4. Gross Profit & Net Profit/Loss
  const grossProfit = roundMoney(totalSales - totalCogs);
  const netProfit = roundMoney(totalSales - totalExpenses);

  // 5. Cash and Digital Breakdown
  let cashTotal = 0;
  let digitalTotal = 0;
  const salesByPaymentMethod = {
    cash: 0,
    gpay: 0,
    phonepe: 0,
    otherUpi: 0,
    upi: 0,
    card: 0,
  };

  eligibleSales.forEach((s) => {
    const amt = s.amount || 0;
    const method = s.paymentMethod || 'Cash';
    const upiApp = (s.upiApp || '').toLowerCase();

    if (method === 'Cash') {
      cashTotal += amt;
      salesByPaymentMethod.cash += amt;
    } else {
      digitalTotal += amt;
      if (method === 'Card') {
        salesByPaymentMethod.card += amt;
      } else if (method === 'GPay' || upiApp.includes('google') || upiApp.includes('gpay')) {
        salesByPaymentMethod.gpay += amt;
        salesByPaymentMethod.upi += amt;
      } else if (method === 'PhonePe' || upiApp.includes('phonepe')) {
        salesByPaymentMethod.phonepe += amt;
        salesByPaymentMethod.upi += amt;
      } else {
        salesByPaymentMethod.otherUpi += amt;
        salesByPaymentMethod.upi += amt;
      }
    }
  });

  // Round breakdown values
  cashTotal = roundMoney(cashTotal);
  digitalTotal = roundMoney(digitalTotal);
  Object.keys(salesByPaymentMethod).forEach((k) => {
    salesByPaymentMethod[k] = roundMoney(salesByPaymentMethod[k]);
  });

  return {
    period,
    startDate: start ? start.toISOString() : null,
    endDate: end ? end.toISOString() : null,
    salesRevenue: totalSales,
    totalSales,
    costOfGoodsSold: totalCogs,
    grossProfit,
    operatingExpenses: totalExpenses,
    totalExpenses,
    netProfit,
    currentBalance: netProfit,
    cashTotal,
    digitalTotal,
    salesCount: eligibleSales.length,
    expensesCount: eligibleExpenses.length,
    salesByPaymentMethod,
    expensesByCategory,
    allSales: sales,
    allExpenses: expenses,
  };
};

export default {
  getDateRange,
  roundMoney,
  calculateFinancialMetrics,
};
