import Sale from '../models/Sale.js';
import Expense from '../models/Expense.js';

export const getDashboardData = async (req, res) => {
  try {
    const { period = 'all', startDate, endDate } = req.query;

    let dateFilter = { userId: req.user._id };

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (period === 'today') {
      dateFilter.createdAt = { $gte: startOfToday };
    } else if (period === 'week') {
      const startOfWeek = new Date(startOfToday);
      startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
      dateFilter.createdAt = { $gte: startOfWeek };
    } else if (period === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter.createdAt = { $gte: startOfMonth };
    } else if (period === 'year') {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      dateFilter.createdAt = { $gte: startOfYear };
    } else if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
      };
    }

    const allSales = await Sale.find(dateFilter);
    const expenses = await Expense.find(dateFilter);

    // Filter Rule: Only include finalized/verified sales for user in financial calculations
    const validSales = allSales.filter((s) => s.paymentStatus === 'success' || s.paymentStatus === 'recorded');

    // Total calculations
    const totalSales = validSales.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const totalExpenses = expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const netProfit = totalSales - totalExpenses;
    const currentBalance = netProfit;

    // Payment method breakdown for Sales
    const salesByPaymentMethod = {
      cash: validSales.filter((s) => s.paymentMethod === 'Cash').reduce((acc, curr) => acc + curr.amount, 0),
      upi: validSales.filter((s) => s.paymentMethod === 'UPI').reduce((acc, curr) => acc + curr.amount, 0),
      card: validSales.filter((s) => s.paymentMethod === 'Card').reduce((acc, curr) => acc + curr.amount, 0),
    };

    // Category breakdown for Expenses
    const expensesByCategory = {
      stock: expenses.filter((e) => e.category === 'Stock').reduce((acc, curr) => acc + curr.amount, 0),
      rent: expenses.filter((e) => e.category === 'Rent').reduce((acc, curr) => acc + curr.amount, 0),
      electricity: expenses.filter((e) => e.category === 'Electricity').reduce((acc, curr) => acc + curr.amount, 0),
      salary: expenses.filter((e) => e.category === 'Salary').reduce((acc, curr) => acc + curr.amount, 0),
      transport: expenses.filter((e) => e.category === 'Transport').reduce((acc, curr) => acc + curr.amount, 0),
      other: expenses.filter((e) => e.category === 'Other').reduce((acc, curr) => acc + curr.amount, 0),
    };

    // Formatted Recent Transactions
    const formattedSales = allSales.map((s) => ({
      id: s._id,
      type: 'Sale',
      detail: s.description || (s.entryMethod === 'automatic' ? `${s.provider} Automatic ${s.paymentMethod}` : 'Shop Sale'),
      category: s.paymentMethod,
      paymentMethod: s.paymentMethod,
      entryMethod: s.entryMethod || 'manual',
      paymentStatus: s.paymentStatus || 'recorded',
      amount: s.amount,
      description: s.description,
      createdAt: s.createdAt,
    }));

    const formattedExpenses = expenses.map((e) => ({
      id: e._id,
      type: 'Expense',
      detail: e.description || e.category,
      category: e.category,
      paymentMethod: e.paymentMethod || 'Cash',
      entryMethod: e.entryMethod || 'manual',
      paymentStatus: e.paymentStatus || 'recorded',
      amount: e.amount,
      description: e.description,
      createdAt: e.createdAt,
    }));

    const recentTransactions = [...formattedSales, ...formattedExpenses]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 8);

    res.status(200).json({
      totalSales,
      totalExpenses,
      netProfit,
      currentBalance,
      salesByPaymentMethod,
      expensesByCategory,
      recentTransactions,
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};
