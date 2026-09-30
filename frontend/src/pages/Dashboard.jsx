import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { getDashboardData } from '../services/api';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PieChart,
  PlusCircle,
  MinusCircle,
  ScanLine,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Calendar,
  CheckCircle2,
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

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await getDashboardData('all');
      setData(res);
    } catch (err) {
      console.error('Error fetching dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const isProfit = data.netProfit >= 0;
  const maxTotal = Math.max(data.totalSales, data.totalExpenses, 1);
  const salesWidth = Math.min(100, Math.round((data.totalSales / maxTotal) * 100));
  const expenseWidth = Math.min(100, Math.round((data.totalExpenses / maxTotal) * 100));

  // Compute ring stroke-dash for donut
  const totalFlow = (data.totalSales + data.totalExpenses) || 1;
  const salesRatio = data.totalSales / totalFlow;
  const circumference = 2 * Math.PI * 40; // r=40
  const salesDash = salesRatio * circumference;

  return (
    <div className="dashboard-container-sleek">
      {/* 1. TOP STATS ROW - 4 Compact KPI Cards */}
      <div className="kpi-grid">
        {/* Total Sales */}
        <div className="kpi-card" onClick={() => navigate('/sales')}>
          <div className="kpi-top">
            <span className="kpi-label">{t('totalSales')}</span>
            <div className="kpi-icon-badge bg-profit-soft">
              <TrendingUp size={16} className="text-profit" />
            </div>
          </div>
          <div className="kpi-amount text-profit">
            ₹{data.totalSales.toLocaleString('en-IN')}
          </div>
          <div className="kpi-footer">
            <span className="kpi-subtext">Cash & Digital income</span>
            <ArrowUpRight size={14} className="text-profit" />
          </div>
        </div>

        {/* Total Expenses */}
        <div className="kpi-card" onClick={() => navigate('/expenses')}>
          <div className="kpi-top">
            <span className="kpi-label">{t('totalSpent')}</span>
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
        <div className="kpi-card" onClick={() => navigate('/profit-loss')}>
          <div className="kpi-top">
            <span className="kpi-label">{t('profitLoss')}</span>
            <div className={`kpi-icon-badge ${isProfit ? 'bg-profit-soft' : 'bg-loss-soft'}`}>
              <PieChart size={16} className={isProfit ? 'text-profit' : 'text-loss'} />
            </div>
          </div>
          <div className={`kpi-amount ${isProfit ? 'text-profit' : 'text-loss'}`}>
            ₹{data.netProfit.toLocaleString('en-IN')}
          </div>
          <div className="kpi-footer">
            <span className={`kpi-chip ${isProfit ? 'chip-profit' : 'chip-loss'}`}>
              {isProfit ? `● ${t('profit')}` : `● ${t('loss')}`}
            </span>
          </div>
        </div>

        {/* Current Balance */}
        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">{t('currentBalance')}</span>
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

      {/* 2. COMPACT QUICK ACTION BAR */}
      <div className="quick-actions-strip">
        <button className="sleek-action-pill btn-action-sale" onClick={() => navigate('/sales')}>
          <PlusCircle size={16} />
          <span>Record Sale</span>
          <span className="pill-shortcut">Cash / UPI</span>
        </button>

        <button className="sleek-action-pill btn-action-expense" onClick={() => navigate('/expenses')}>
          <MinusCircle size={16} />
          <span>Record Expense</span>
          <span className="pill-shortcut">Bills & Stock</span>
        </button>

        <button className="sleek-action-pill btn-action-scan" onClick={() => navigate('/scan')}>
          <ScanLine size={16} />
          <span>Smart OCR Scan</span>
          <span className="pill-shortcut">Auto-detect</span>
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
                <span className="flow-label">{t('salesOverview')}</span>
                <span className="flow-val text-profit">₹{data.totalSales.toLocaleString('en-IN')}</span>
              </div>
              <div className="flow-track">
                <div className="flow-fill fill-emerald" style={{ width: `${salesWidth}%` }} />
              </div>
            </div>

            <div className="flow-item">
              <div className="flow-meta">
                <span className="flow-label">{t('expenseOverview')}</span>
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
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#f1f5f9"
                strokeWidth="7"
              />
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
              />
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

      {/* 4. RECENT TRANSACTIONS TABLE */}
      <div className="sleek-panel tx-panel-compact">
        <div className="panel-header-compact">
          <div className="tx-header-left">
            <h3 className="panel-heading">{t('recentTransactions')}</h3>
            <span className="badge-count">{data.recentTransactions.length} items</span>
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
              <span>{t('viewAll')}</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {data.recentTransactions.length === 0 ? (
          <div className="empty-state-compact">
            <div className="empty-icon-circle">
              <Calendar size={22} className="text-muted" />
            </div>
            <p className="empty-title">{t('noTransactions')}</p>
            <p className="empty-subtitle">Record your first sale or expense to see real-time updates.</p>
          </div>
        ) : (
          <div className="sleek-table-container">
            <table className="compact-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Transaction Detail</th>
                  <th>Method</th>
                  <th>Source</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.recentTransactions.slice(0, 5).map((tx) => (
                  <tr key={tx.id || tx.rawId || Math.random()}>
                    <td className="cell-date-dim">{tx.date || 'Today'}</td>
                    <td>
                      <div className="tx-item-flex">
                        <span className={`icon-indicator ${tx.type === 'Sale' ? 'ind-sale' : 'ind-expense'}`}>
                          {tx.type === 'Sale' ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                        </span>
                        <strong className="tx-desc-title">{tx.detail || (tx.type === 'Sale' ? 'Cash Sale' : 'Store Expense')}</strong>
                      </div>
                    </td>
                    <td>
                      <span className={`cell-payment-tag ${tx.paymentMethod === 'UPI' ? 'pm-upi-tag' : ''}`}>
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
                        {tx.type === 'Sale' ? '+' : '-'} ₹{tx.amount?.toLocaleString('en-IN')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
