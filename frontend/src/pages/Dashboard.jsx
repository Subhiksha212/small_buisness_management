import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { getDashboardData, getDashboardInsights } from '../services/api';
import useRealtimeEvents from '../hooks/useRealtimeEvents';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Clock,
  PlusCircle,
  MinusCircle,
  ScanLine,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Smartphone,
  Brain,
  X,
} from 'lucide-react';

const Dashboard = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [data, setData] = useState({
    totalSales: 0,
    totalExpenses: 0,
    netProfit: 0,
    currentBalance: 0,
    salesByPaymentMethod: { cash: 0, upi: 0, card: 0 },
    expensesByCategory: { stock: 0, rent: 0, electricity: 0, salary: 0, transport: 0, other: 0 },
    recentTransactions: [],
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Today');
  const [showInsight, setShowInsight] = useState(true);
  const [insightsText, setInsightsText] = useState(
    'Real-time data synchronization is active. All financial flows update automatically.'
  );

  const fetchDashboard = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true);
      const res = await getDashboardData('all');
      setData(res);
    } catch (err) {
      console.error('Error fetching dashboard:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  const fetchInsights = useCallback(async () => {
    try {
      const res = await getDashboardInsights();
      if (res && res.recommendations && res.recommendations.length > 0) {
        setInsightsText(res.recommendations[0]);
      } else if (res && res.summary) {
        setInsightsText(res.summary);
      }
    } catch (err) {
      // Keep default fallback
    }
  }, []);

  // Real-Time Event Subscription (No polling!)
  const { isConnected } = useRealtimeEvents({
    onPaymentSuccess: () => fetchDashboard(false),
    onSaleCreated: () => fetchDashboard(false),
    onExpenseCreated: () => fetchDashboard(false),
    onTransactionCreated: () => fetchDashboard(false),
    onReconnect: () => fetchDashboard(false),
  });

  useEffect(() => {
    fetchDashboard(true);
  }, [fetchDashboard]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  const isProfit = data.netProfit >= 0;
  const maxTotal = Math.max(data.totalSales, data.totalExpenses, 1);
  const salesWidth = Math.min(100, Math.round((data.totalSales / maxTotal) * 100));
  const expenseWidth = Math.min(100, Math.round((data.totalExpenses / maxTotal) * 100));

  // Compute ring stroke-dash for donut
  const totalFlow = (data.totalSales + data.totalExpenses) || 1;
  const salesRatio = data.totalSales / totalFlow;
  const circumference = 2 * Math.PI * 40; // r=40
  const salesDash = salesRatio * circumference;

  // Filter transactions based on active segment tab
  const filteredTransactions = (data.recentTransactions || []).filter((tx) => {
    if (activeTab === 'Today') {
      const txDate = new Date(tx.createdAt || Date.now());
      const today = new Date();
      return (
        txDate.getDate() === today.getDate() &&
        txDate.getMonth() === today.getMonth() &&
        txDate.getFullYear() === today.getFullYear()
      );
    }
    if (activeTab === 'This Week') {
      const txDate = new Date(tx.createdAt || Date.now());
      const now = new Date();
      const diffDays = (now - txDate) / (1000 * 60 * 60 * 24);
      return diffDays <= 7;
    }
    if (activeTab === 'This Month') {
      const txDate = new Date(tx.createdAt || Date.now());
      const today = new Date();
      return (
        txDate.getMonth() === today.getMonth() &&
        txDate.getFullYear() === today.getFullYear()
      );
    }
    return true;
  });

  const displayTransactions = filteredTransactions.length > 0 ? filteredTransactions : data.recentTransactions;

  return (
    <div className="dashboard-container-sleek">
      {/* Live SSE Status Bar & Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: '#ffffff', letterSpacing: '-0.3px' }}>
          {t('dashboard') || 'dashboard'}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            className="pl-simulator-btn"
            onClick={() => navigate('/upi-app')}
            title="Open Interactive Simulated UPI Mobile App"
          >
            <Smartphone size={13} style={{ color: '#38bdf8' }} />
            <span>Open UPI App Simulator</span>
          </button>

          <span className="pl-sync-badge">
            <span className="pl-sync-dot" />
            <span>{isConnected ? 'Real-Time Sync Active' : 'Connecting to Live Events...'}</span>
          </span>
        </div>
      </div>

      {/* 1. TOP STATS ROW - 4 Compact KPI Cards with Glowing Borders */}
      <div className="kpi-grid">
        {/* Total Sales */}
        <div className="kpi-card kpi-card-sales" onClick={() => navigate('/transactions')}>
          <div className="kpi-top">
            <span className="kpi-label">{t('totalSales') || 'TOTAL SALES'}</span>
            <div className="kpi-icon-badge bg-profit-soft">
              <TrendingUp size={16} className="text-profit" />
            </div>
          </div>
          <div className="kpi-amount text-profit">
            ₹{data.totalSales.toLocaleString('en-IN')}
          </div>
          <div className="kpi-footer">
            <span className="kpi-subtext">Cash &amp; Digital income</span>
            <ArrowUpRight size={14} className="text-profit" />
          </div>
        </div>

        {/* Total Expenses */}
        <div className="kpi-card kpi-card-spent" onClick={() => navigate('/expenses')}>
          <div className="kpi-top">
            <span className="kpi-label">{t('totalSpent') || 'TOTAL SPENT'}</span>
            <div className="kpi-icon-badge bg-loss-soft">
              <TrendingDown size={16} className="text-loss" />
            </div>
          </div>
          <div className="kpi-amount text-loss">
            ₹{data.totalExpenses.toLocaleString('en-IN')}
          </div>
          <div className="kpi-footer">
            <span className="kpi-subtext">Operational costs</span>
            <ArrowDownRight size={14} className="text-loss" />
          </div>
        </div>

        {/* Net Profit / Margin */}
        <div className="kpi-card kpi-card-profit" onClick={() => navigate('/profit-loss')}>
          <div className="kpi-top">
            <span className="kpi-label">{t('profitLoss') || 'PROFIT / LOSS'}</span>
            <div className="kpi-icon-badge bg-profit-soft">
              <Clock size={16} className={isProfit ? 'text-profit' : 'text-loss'} />
            </div>
          </div>
          <div className={`kpi-amount ${isProfit ? 'text-profit' : 'text-loss'}`}>
            ₹{data.netProfit.toLocaleString('en-IN')}
          </div>
          <div className="kpi-footer">
            <span className={`kpi-chip ${isProfit ? 'chip-profit' : 'chip-loss'}`}>
              {isProfit ? `● ${t('profit') || 'PROFIT'}` : `● ${t('loss') || 'LOSS'}`}
            </span>
          </div>
        </div>

        {/* Current Balance */}
        <div className="kpi-card kpi-card-balance" onClick={() => navigate('/transactions')}>
          <div className="kpi-top">
            <span className="kpi-label">{t('currentBalance') || 'CURRENT BALANCE'}</span>
            <div className="kpi-icon-badge bg-cyan-soft">
              <Wallet size={16} className="text-cyan" />
            </div>
          </div>
          <div className="kpi-amount text-cyan">
            ₹{data.currentBalance.toLocaleString('en-IN')}
          </div>
          <div className="kpi-footer">
            <span className="kpi-subtext">Available capital (INR)</span>
          </div>
        </div>
      </div>

      {/* 2. COMPACT QUICK ACTION BAR (Dark Glassmorphic Pills) */}
      <div className="quick-actions-strip">
        <button className="sleek-action-pill btn-action-sale" onClick={() => navigate('/add-sale')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PlusCircle size={16} style={{ color: '#2dd4bf' }} />
            <span>Record Sale</span>
          </div>
          <span className="pill-shortcut">Cash / UPI</span>
        </button>

        <button className="sleek-action-pill btn-action-expense" onClick={() => navigate('/expenses')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MinusCircle size={16} style={{ color: '#f87171' }} />
            <span>Record Expense</span>
          </div>
          <span className="pill-shortcut">Bills &amp; Stock</span>
        </button>

        <button className="sleek-action-pill btn-action-scan" onClick={() => navigate('/scan')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ScanLine size={16} style={{ color: '#38bdf8' }} />
            <span>Scan Product QR</span>
          </div>
          <span className="pill-shortcut">Auto Add to Ledger</span>
        </button>
      </div>

      {/* 3. MIDDLE SECTION: Balance Comparison & Radial Donut */}
      <div className="overview-row-sleek">
        {/* Daily Flow Overview */}
        <div className="sleek-panel flow-panel">
          <div className="panel-header-compact">
            <div>
              <h3 className="panel-heading">Daily Balance Overview</h3>
              <p className="panel-subheading">Ratio of revenue inflows against store expenditure</p>
            </div>
            <div className="compact-legend">
              <span className="legend-item"><span className="legend-dot dot-emerald"></span> Inflow</span>
              <span className="legend-item"><span className="legend-dot dot-rose"></span> Outflow</span>
            </div>
          </div>

          <div className="flow-bars-container">
            <div className="flow-item">
              <div className="flow-meta">
                <span className="flow-label">{t('salesOverview') || 'Sales Overview'}</span>
                <span className="flow-val text-profit">₹{data.totalSales.toLocaleString('en-IN')}</span>
              </div>
              <div className="flow-track">
                <div className="flow-fill fill-emerald" style={{ width: `${salesWidth}%` }} />
              </div>
            </div>

            <div className="flow-item">
              <div className="flow-meta">
                <span className="flow-label">{t('expenseOverview') || 'Expense Overview'}</span>
                <span className="flow-val text-loss">₹{data.totalExpenses.toLocaleString('en-IN')}</span>
              </div>
              <div className="flow-track">
                <div className="flow-fill fill-rose" style={{ width: `${expenseWidth}%` }} />
              </div>
            </div>
          </div>

          <div className="flow-chips-row">
            <div className="method-micro-chip">
              <span className="chip-muted">Cash:</span>
              <strong>₹{(data.salesByPaymentMethod?.cash || 0).toLocaleString('en-IN')}</strong>
            </div>
            <div className="method-micro-chip">
              <span className="chip-muted">UPI:</span>
              <strong>₹{(data.salesByPaymentMethod?.upi || 0).toLocaleString('en-IN')}</strong>
            </div>
            <div className="method-micro-chip">
              <span className="chip-muted">Card:</span>
              <strong>₹{(data.salesByPaymentMethod?.card || 0).toLocaleString('en-IN')}</strong>
            </div>
          </div>
        </div>

        {/* Balance Donut Statistic */}
        <div className="sleek-panel donut-panel">
          <div className="panel-header-compact">
            <h3 className="panel-heading">Balance Statistic</h3>
            <span className="badge-currency">INR</span>
          </div>

          <div className="svg-donut-wrapper">
            <svg viewBox="0 0 100 100" className="donut-svg">
              {/* Background dark ring track */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth="7"
              />
              {/* Green Inflow / Sales arc */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#10b981"
                strokeWidth="7"
                strokeDasharray={`${salesDash} ${circumference}`}
                strokeDashoffset="0"
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
                style={{ transition: 'stroke-dasharray 0.5s ease' }}
              />
              {/* Red Outflow / Expense arc */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#ef4444"
                strokeWidth="7"
                strokeDasharray={`${circumference - salesDash} ${circumference}`}
                strokeDashoffset={`${-salesDash}`}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
                style={{ transition: 'stroke-dasharray 0.5s ease' }}
              />
            </svg>
            <div className="donut-inner-content">
              <span className="donut-num">₹{data.currentBalance.toLocaleString('en-IN')}</span>
              <span className="donut-sub">Net Liquid</span>
            </div>
          </div>

          <div className="donut-footer-legend">
            <div className="d-legend-item">
              <span className="legend-dot dot-emerald"></span>
              <span>Sales: {totalFlow ? Math.round((data.totalSales / totalFlow) * 100) : 0}%</span>
            </div>
            <div className="d-legend-item">
              <span className="legend-dot dot-rose"></span>
              <span>Expenses: {totalFlow ? Math.round((data.totalExpenses / totalFlow) * 100) : 0}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. RECENT TRANSACTIONS TABLE (Full Width) */}
      <div className="sleek-panel tx-panel-compact">
        <div className="panel-header-compact">
          <div className="tx-header-left">
            <h3 className="panel-heading">{t('recentTransactions') || 'Recent Transactions'}</h3>
            <span className="badge-count">{(data.recentTransactions || []).length} items</span>
          </div>

          <div className="tx-header-right">
            <div className="mini-segmented-control">
              {['Today', 'This Week', 'This Month'].map((tab) => (
                <button
                  key={tab}
                  className={`mini-segment-btn ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            <button className="link-see-all" onClick={() => navigate('/transactions')}>
              <span>{t('viewAll') || 'View All'}</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {displayTransactions.length === 0 ? (
          <div className="empty-state-compact">
            <div className="empty-icon-circle">
              <Calendar size={20} className="text-muted" />
            </div>
            <p className="empty-title">{t('noTransactions') || 'No transactions found'}</p>
            <p className="empty-subtitle">Record your first sale or expense to see real-time updates.</p>
          </div>
        ) : (
          <div className="sleek-table-container">
            <table className="compact-table">
              <thead>
                <tr>
                  <th>DATE &amp; TIME</th>
                  <th>TRANSACTION DETAIL</th>
                  <th>METHOD</th>
                  <th>SOURCE</th>
                  <th style={{ textAlign: 'right' }}>AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {displayTransactions.slice(0, 5).map((tx) => (
                  <tr key={tx.id || tx.rawId || Math.random()}>
                    <td className="cell-date-dim">{tx.date || 'Today'}</td>
                    <td>
                      <div className="tx-item-flex">
                        <span className={`icon-indicator ${tx.type === 'Sale' ? 'ind-sale' : 'ind-expense'}`}>
                          {tx.type === 'Sale' ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                        </span>
                        <strong className="tx-desc-title">
                          {tx.detail || (tx.type === 'Sale' ? 'Voice Cash Sale' : 'Store Expense')}
                        </strong>
                      </div>
                    </td>
                    <td>
                      <span className="cell-payment-tag">
                        {tx.paymentMethod === 'UPI' && tx.upiApp ? tx.upiApp : (tx.paymentMethod || 'Cash')}
                      </span>
                    </td>
                    <td>
                      <span className={`micro-source-pill ${tx.entryMethod === 'scanned' ? 'src-scanned' : tx.entryMethod === 'automatic' ? 'src-auto' : 'src-manual'}`}>
                        {tx.entryMethod || 'manual'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className={`tx-amount-compact ${tx.type === 'Sale' ? 'text-profit' : 'text-loss'}`}>
                        {tx.type === 'Sale' ? '+' : '-'} ₹{Number(tx.amount || 0).toLocaleString('en-IN')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Floating Real-Time AI Insights Pill */}
      {showInsight && (
        <div className="pl-insights-floating">
          <div className="pl-insights-brain">
            <Brain size={18} />
          </div>
          <div className="pl-insights-text">
            <strong>Insights:</strong> {insightsText}
          </div>
          <button
            onClick={() => setShowInsight(false)}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              padding: '2px',
              marginLeft: '4px',
            }}
            title="Dismiss insight"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
