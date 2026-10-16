import Sale from '../models/Sale.js';
import Expense from '../models/Expense.js';
import Product from '../models/Product.js';

/**
 * Practical Sales Forecasting & Business Insights Service
 * Generates explainable, evidence-based recommendations from historical business records.
 * Strictly avoids ungrounded certainty or guessing.
 */
export const generateBusinessInsights = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required for generating insights.');
  }

  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const last30Days = new Date(now.getTime() - 30 * dayMs);
  const prev30Days = new Date(now.getTime() - 60 * dayMs);

  // 1. Fetch products, sales, and expenses for authenticated shop
  const [products, recentSales, priorSales, recentExpenses, priorExpenses] = await Promise.all([
    Product.find({ userId, isActive: true }).lean(),
    Sale.find({
      userId,
      paymentStatus: 'success',
      isTest: { $ne: true },
      createdAt: { $gte: last30Days },
    }).lean(),
    Sale.find({
      userId,
      paymentStatus: 'success',
      isTest: { $ne: true },
      createdAt: { $gte: prev30Days, $lt: last30Days },
    }).lean(),
    Expense.find({
      userId,
      paymentStatus: 'success',
      isTest: { $ne: true },
      createdAt: { $gte: last30Days },
    }).lean(),
    Expense.find({
      userId,
      paymentStatus: 'success',
      isTest: { $ne: true },
      createdAt: { $gte: prev30Days, $lt: last30Days },
    }).lean(),
  ]);

  const insights = [];

  // Check if there is enough historical data
  const totalSalesCount = recentSales.length + priorSales.length;
  if (totalSalesCount < 3) {
    return {
      hasSufficientData: false,
      message: 'More transaction data needed to produce reliable trends. Log at least 5-10 sales across 1-2 weeks.',
      insights: [
        {
          id: 'insufficient-data',
          type: 'data_notice',
          title: 'Collecting Baseline Data',
          recommendation: 'Continue recording daily shop transactions to unlock pattern detection.',
          reason: `Only ${totalSalesCount} transaction(s) recorded so far. A minimum of 5-10 sales provides reliable demand velocity.`,
          dataPeriodUsed: 'Past 30 days',
          confidence: 'Low (Insufficient historical data)',
          suggestedAction: 'Record cash and UPI sales accurately at counter or import daily receipts.',
        },
      ],
      peakDays: [],
      velocityAlerts: [],
      expenseAlerts: [],
    };
  }

  // 2. Low Remaining Stock & Reorder Quantity Recommendations
  products.forEach((p) => {
    const threshold = p.minStockThreshold !== undefined ? p.minStockThreshold : 5;
    if (p.stockQuantity <= threshold) {
      const reorderQty = Math.max(10, threshold * 2 - p.stockQuantity);
      insights.push({
        id: `low-stock-${p._id}`,
        type: 'low_stock',
        title: `Low Stock: "${p.name}"`,
        recommendation: `Reorder approximately ${reorderQty} units of ${p.name} to prevent stockout.`,
        reason: `Current stock is ${p.stockQuantity} unit(s), which is at or below your safety threshold of ${threshold}.`,
        dataPeriodUsed: 'Current inventory level',
        confidence: 'High',
        suggestedAction: `Place a purchase order for ${reorderQty} units (estimated cost ₹${reorderQty * (p.costPrice || 0)}).`,
        product: { id: p._id, name: p.name, currentStock: p.stockQuantity, threshold },
      });
    }
  });

  // 3. Product Sales Velocity (Items selling faster or declining)
  // Aggregate sales by product for last 30 days vs prior 30 days
  const recentQty = {};
  const priorQty = {};

  recentSales.forEach((s) => {
    if (s.items && s.items.length > 0) {
      s.items.forEach((item) => {
        const key = String(item.productId || item.name);
        recentQty[key] = (recentQty[key] || 0) + (item.quantity || 1);
      });
    }
  });

  priorSales.forEach((s) => {
    if (s.items && s.items.length > 0) {
      s.items.forEach((item) => {
        const key = String(item.productId || item.name);
        priorQty[key] = (priorQty[key] || 0) + (item.quantity || 1);
      });
    }
  });

  products.forEach((p) => {
    const key = String(p._id);
    const recentUnits = recentQty[key] || 0;
    const priorUnits = priorQty[key] || 0;

    if (recentUnits >= 5 && recentUnits > priorUnits * 1.4) {
      // Selling faster than usual
      insights.push({
        id: `velocity-${p._id}`,
        type: 'sales_velocity',
        title: `Accelerating Demand: "${p.name}"`,
        recommendation: `Increase display priority and safety stock for ${p.name}.`,
        reason: `Sales increased to ${recentUnits} units in the last 30 days compared to ${priorUnits} units in the previous period (+${Math.round(((recentUnits - priorUnits) / Math.max(1, priorUnits)) * 100)}%).`,
        dataPeriodUsed: 'Last 30 days vs previous 30 days',
        confidence: 'Medium',
        suggestedAction: 'Ensure distributor supply is confirmed for the coming month.',
        product: { id: p._id, name: p.name, recentUnits, priorUnits },
      });
    } else if (priorUnits >= 5 && recentUnits < priorUnits * 0.5) {
      // Declining demand
      insights.push({
        id: `declining-${p._id}`,
        type: 'declining_demand',
        title: `Demand Drop: "${p.name}"`,
        recommendation: `Avoid over-purchasing stock for ${p.name} until demand rebounds.`,
        reason: `Sales dropped from ${priorUnits} units down to ${recentUnits} units over the last 30 days (-${Math.round(((priorUnits - recentUnits) / priorUnits) * 100)}%).`,
        dataPeriodUsed: 'Last 30 days vs previous 30 days',
        confidence: 'Medium',
        suggestedAction: 'Consider bundling or promotional pricing to liquidate stagnant units.',
        product: { id: p._id, name: p.name, recentUnits, priorUnits },
      });
    }
  });

  // 4. Peak Sales Period Observation (Day of Week Analysis)
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const daySalesTotals = [0, 0, 0, 0, 0, 0, 0];
  recentSales.forEach((s) => {
    const day = new Date(s.createdAt).getDay();
    daySalesTotals[day] += s.amount || 0;
  });

  const maxDayIndex = daySalesTotals.indexOf(Math.max(...daySalesTotals));
  const maxDayTotal = daySalesTotals[maxDayIndex];
  const totalPeriodSales = recentSales.reduce((a, b) => a + (b.amount || 0), 0);

  if (totalPeriodSales > 0 && maxDayTotal > totalPeriodSales * 0.25) {
    const peakDayName = dayNames[maxDayIndex];
    insights.push({
      id: 'peak-day-insight',
      type: 'peak_period',
      title: `Highest Observed Sales: ${peakDayName}s`,
      recommendation: `Prepare inventory and staffing ahead of ${peakDayName}.`,
      reason: `${peakDayName} accounts for ₹${Math.round(maxDayTotal)} (${Math.round((maxDayTotal / totalPeriodSales) * 100)}% of total observed revenue this month).`,
      dataPeriodUsed: 'Last 30 days sales distribution',
      confidence: 'Medium',
      suggestedAction: `Ensure shelves and payment QR codes are readily visible for ${peakDayName} customer influx.`,
    });
  }

  // 5. Expense Spike Detection (Category by Category)
  const recentExpByCat = {};
  const priorExpByCat = {};

  recentExpenses.forEach((e) => {
    const cat = e.category || 'Other';
    recentExpByCat[cat] = (recentExpByCat[cat] || 0) + (e.amount || 0);
  });

  priorExpenses.forEach((e) => {
    const cat = e.category || 'Other';
    priorExpByCat[cat] = (priorExpByCat[cat] || 0) + (e.amount || 0);
  });

  Object.keys(recentExpByCat).forEach((cat) => {
    const recentCost = recentExpByCat[cat] || 0;
    const priorCost = priorExpByCat[cat] || 0;

    if (priorCost > 500 && recentCost > priorCost * 1.35) {
      const diff = Math.round(recentCost - priorCost);
      insights.push({
        id: `expense-spike-${cat}`,
        type: 'expense_increase',
        title: `Expense Increase: ${cat}`,
        recommendation: `Review recent receipts and invoices for ${cat}.`,
        reason: `${cat} costs rose from ₹${Math.round(priorCost)} to ₹${Math.round(recentCost)} (+₹${diff}, +${Math.round(((recentCost - priorCost) / priorCost) * 100)}%).`,
        dataPeriodUsed: 'Last 30 days compared with previous 30 days',
        confidence: 'High',
        suggestedAction: 'Audit utility consumption or negotiate wholesale prices with suppliers.',
      });
    }
  });

  return {
    hasSufficientData: true,
    totalInsightsCount: insights.length,
    insights,
    dataPeriod: 'Past 30 days vs prior 30 days',
  };
};

export default {
  generateBusinessInsights,
};
