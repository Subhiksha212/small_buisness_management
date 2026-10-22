import { calculateFinancialMetrics } from '../services/financialService.js';
import BankTransaction from '../models/BankTransaction.js';

export const getDashboardData = async (req, res) => {
  try {
    const { period = 'all', startDate, endDate, includeTest } = req.query;
    const isTestEnv = process.env.NODE_ENV === 'test' || process.env.PAYMENT_ENV === 'sandbox';
    const shouldIncludeTest = includeTest === 'true' || includeTest === true || (includeTest !== 'false' && isTestEnv);

    const metrics = await calculateFinancialMetrics({
      userId: req.user._id,
      period,
      startDate,
      endDate,
      includeTest: shouldIncludeTest,
    });

    // Formatted Recent Transactions
    const formattedSales = metrics.allSales.map((s) => ({
      id: s._id,
      type: 'Sale',
      detail: s.description || (s.entryMethod === 'automatic' ? `${s.provider || 'UPI'} Payment` : 'Shop Sale'),
      category: s.paymentMethod,
      paymentMethod: s.paymentMethod,
      verificationStatus: s.verificationStatus || (s.entryMethod === 'automatic' ? 'verified' : 'manual_entry'),
      upiApp: s.upiApp || s.provider,
      utrNumber: s.utrNumber,
      provider: s.provider,
      entryMethod: s.entryMethod || 'manual',
      paymentStatus: s.paymentStatus || 'recorded',
      amount: s.amount,
      description: s.description,
      isTest: s.isTest || false,
      createdAt: s.createdAt,
    }));

    const formattedExpenses = metrics.allExpenses.map((e) => ({
      id: e._id,
      type: 'Expense',
      detail: e.description || (e.paidTo ? `Paid to ${e.paidTo}` : e.category),
      category: e.category,
      paidTo: e.paidTo,
      paymentMethod: e.paymentMethod || 'Cash',
      upiApp: e.upiApp || e.provider,
      utrNumber: e.utrNumber,
      provider: e.provider,
      entryMethod: e.entryMethod || 'manual',
      paymentStatus: e.paymentStatus || 'recorded',
      amount: e.amount,
      description: e.description,
      isTest: e.isTest || false,
      createdAt: e.createdAt,
    }));

    // Fetch imported Bank Feed transactions (Setu Account Aggregator)
    const bankFilter = { userId: req.user._id };
    if (!shouldIncludeTest) {
      bankFilter.isTest = { $ne: true };
    }
    const bankTxns = await BankTransaction.find(bankFilter)
      .sort({ transactionTimestamp: -1 })
      .limit(10)
      .lean();

    const formattedBank = bankTxns.map((b) => ({
      id: b._id,
      type: b.type === 'CREDIT' ? 'Bank Credit' : 'Bank Debit',
      detail: b.narration || (b.type === 'CREDIT' ? 'Setu AA Deposit' : 'Setu AA Withdrawal'),
      category: 'Bank Feed',
      paymentMethod: b.mode || 'Bank Transfer',
      verificationStatus: b.isTest ? 'sandbox_test' : 'provider_verified',
      upiApp: b.mode || 'Setu AA',
      utrNumber: b.reference,
      provider: 'Setu AA',
      entryMethod: 'setu_aa',
      paymentStatus: 'success',
      amount: b.amount,
      description: b.narration,
      isTest: b.isTest || false,
      createdAt: b.transactionTimestamp || b.createdAt,
      source: b.source,
      accountMasked: b.accountMasked,
      classification: b.classification,
      alreadyExistsInApp: b.alreadyExistsInApp,
    }));

    const recentTransactions = [...formattedSales, ...formattedExpenses, ...formattedBank]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10);

    const bankFeedCount = await BankTransaction.countDocuments(bankFilter);

    // Compute last 6 months trends from real database records
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const monthlyTrends = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const monthIdx = d.getMonth();
      const monthLabel = monthNames[monthIdx];

      const monthSales = metrics.allSales
        ? metrics.allSales
            .filter((s) => {
              const sDate = new Date(s.createdAt);
              return sDate.getFullYear() === year && sDate.getMonth() === monthIdx;
            })
            .reduce((sum, s) => sum + (Number(s.amount) || 0), 0)
        : 0;

      const monthSpent = metrics.allExpenses
        ? metrics.allExpenses
            .filter((e) => {
              const eDate = new Date(e.createdAt);
              return eDate.getFullYear() === year && eDate.getMonth() === monthIdx;
            })
            .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
        : 0;

      monthlyTrends.push({
        month: monthLabel,
        year,
        sales: Math.round(monthSales),
        spent: Math.round(monthSpent),
      });
    }

    // Calculate real % change vs previous month
    const curSales = monthlyTrends[5]?.sales || 0;
    const prevSales = monthlyTrends[4]?.sales || 0;
    let salesTrendPct = '+0.0%';
    if (prevSales > 0) {
      const diff = (((curSales - prevSales) / prevSales) * 100).toFixed(1);
      salesTrendPct = `${diff >= 0 ? '+' : ''}${diff}%`;
    } else if (curSales > 0) {
      salesTrendPct = '+100%';
    }

    const curSpent = monthlyTrends[5]?.spent || 0;
    const prevSpent = monthlyTrends[4]?.spent || 0;
    let spentTrendPct = '+0.0%';
    if (prevSpent > 0) {
      const diff = (((curSpent - prevSpent) / prevSpent) * 100).toFixed(1);
      spentTrendPct = `${diff >= 0 ? '+' : ''}${diff}%`;
    } else if (curSpent > 0) {
      spentTrendPct = '+100%';
    }

    res.status(200).json({
      period: metrics.period,
      startDate: metrics.startDate,
      endDate: metrics.endDate,
      totalSales: metrics.totalSales,
      salesRevenue: metrics.salesRevenue,
      costOfGoodsSold: metrics.costOfGoodsSold,
      grossProfit: metrics.grossProfit,
      totalExpenses: metrics.totalExpenses,
      operatingExpenses: metrics.operatingExpenses,
      netProfit: metrics.netProfit,
      currentBalance: metrics.currentBalance,
      cashTotal: metrics.cashTotal,
      digitalTotal: metrics.digitalTotal,
      salesCount: metrics.salesCount,
      expensesCount: metrics.expensesCount,
      salesByPaymentMethod: metrics.salesByPaymentMethod,
      expensesByCategory: metrics.expensesByCategory,
      recentTransactions,
      monthlyTrends,
      salesTrendPct,
      spentTrendPct,
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

import { generateBusinessInsights } from '../services/forecastingService.js';

export const getDashboardInsights = async (req, res) => {
  try {
    const report = await generateBusinessInsights(req.user._id);
    res.status(200).json(report);
  } catch (error) {
    console.error('Error generating business insights:', error);
    res.status(500).json({ message: 'Failed to generate business insights.' });
  }
};
