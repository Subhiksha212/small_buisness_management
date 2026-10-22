import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { getDashboardData, getDashboardInsights } from '../services/api';
import useRealtimeEvents from '../hooks/useRealtimeEvents';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Plus,
  ChevronRight,
  Brain,
  Check,
  X,
  PieChart,
  Banknote,
  Briefcase,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

// Glowing Sparkline Component
const Sparkline = ({ color = '#2dd4bf', type = 'up' }) => {
  const gradId = `spark-${color.replace('#', '')}-${type}`;
  return (
    <svg width="105" height="38" viewBox="0 0 105 38" fill="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      {type === 'up' ? (
        <>
          <path
            d="M 2 30 C 18 28, 30 33, 48 18 C 66 3, 80 20, 102 7"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M 2 30 C 18 28, 30 33, 48 18 C 66 3, 80 20, 102 7 L 102 38 L 2 38 Z"
            fill={`url(#${gradId})`}
          />
        </>
      ) : (
        <>
          <path
            d="M 2 8 C 18 10, 32 3, 50 18 C 68 32, 82 18, 102 26"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M 2 8 C 18 10, 32 3, 50 18 C 68 32, 82 18, 102 26 L 102 38 L 2 38 Z"
            fill={`url(#${gradId})`}
          />
        </>
      )}
    </svg>
  );
};

// Real-Time Dynamic Monthly Trends Area Chart
const MonthlyTrendsChart = ({ monthlyTrends = [] }) => {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // If no trends data, generate current 6 calendar months
  const now = new Date();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fallbackTrends = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    fallbackTrends.push({
      month: monthNames[d.getMonth()],
      sales: 0,
      spent: 0,
    });
  }

  const trends = (monthlyTrends && monthlyTrends.length === 6) ? monthlyTrends : fallbackTrends;

  // Compute dynamic max value for Y-axis
  const maxRecorded = Math.max(
    ...trends.map((t) => Math.max(Number(t.sales) || 0, Number(t.spent) || 0)),
    100
  );
  // Round up to clean ceiling (e.g., 500, 1000, 2500, 5000)
  const maxCeil = Math.max(Math.ceil(maxRecorded / 500) * 500, 500);

  const yTicks = [
    `₹${maxCeil.toLocaleString('en-IN')}`,
    `₹${Math.round(maxCeil * 0.8).toLocaleString('en-IN')}`,
    `₹${Math.round(maxCeil * 0.6).toLocaleString('en-IN')}`,
    `₹${Math.round(maxCeil * 0.4).toLocaleString('en-IN')}`,
    `₹${Math.round(maxCeil * 0.2).toLocaleString('en-IN')}`,
    '0',
  ];

  // Map data points into SVG coordinates (width: 380, height: 170)
  // X: 50, 110, 170, 230, 290, 350
  // Y range: 25 (top) to 142 (baseline zero)
  const chartHeight = 117;
  const zeroY = 142;

  const salesPoints = trends.map((t, idx) => {
    const x = 50 + idx * 60;
    const y = zeroY - Math.min((t.sales / maxCeil) * chartHeight, chartHeight);
    return { x, y, val: `₹${Number(t.sales).toLocaleString('en-IN')}`, month: t.month };
  });

  const spentPoints = trends.map((t, idx) => {
    const x = 50 + idx * 60;
    const y = zeroY - Math.min((t.spent / maxCeil) * chartHeight, chartHeight);
    return { x, y, val: `₹${Number(t.spent).toLocaleString('en-IN')}`, month: t.month };
  });

  // Build smooth cubic Bezier paths
  const buildSmoothPath = (points) => {
    if (!points || points.length === 0) return '';
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cx1 = p0.x + (p1.x - p0.x) / 2;
      const cy1 = p0.y;
      const cx2 = p0.x + (p1.x - p0.x) / 2;
      const cy2 = p1.y;
      d += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p1.x} ${p1.y}`;
    }
    return d;
  };

  const salesPath = buildSmoothPath(salesPoints);
  const spentPath = buildSmoothPath(spentPoints);

  return (
    <div style={{ position: 'relative', width: '100%', height: '220px', marginTop: '10px' }}>
      <svg
        viewBox="0 0 380 170"
        style={{ width: '100%', height: '100%', overflow: 'visible' }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="liveSalesGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
            <stop offset="60%" stopColor="#10b981" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="liveSpentGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.35" />
            <stop offset="70%" stopColor="#ef4444" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Y Axis Grid Lines */}
        {[25, 48, 72, 95, 118, 142].map((y, idx) => (
          <g key={y}>
            <line
              x1="45"
              y1={y}
              x2="365"
              y2={y}
              stroke="rgba(255, 255, 255, 0.07)"
              strokeDasharray="3 3"
            />
            <text
              x="40"
              y={y + 3}
              fill="#64748b"
              fontSize="9"
              textAnchor="end"
              fontFamily="sans-serif"
            >
              {yTicks[idx]}
            </text>
          </g>
        ))}

        {/* Spent Area (Red) */}
        {spentPath && (
          <>
            <path d={`${spentPath} L 350 ${zeroY} L 50 ${zeroY} Z`} fill="url(#liveSpentGrad)" />
            <path d={spentPath} stroke="#f87171" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          </>
        )}

        {/* Sales Area (Green) */}
        {salesPath && (
          <>
            <path d={`${salesPath} L 350 ${zeroY} L 50 ${zeroY} Z`} fill="url(#liveSalesGrad)" />
            <path d={salesPath} stroke="#34d399" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          </>
        )}

        {/* Sales Data Dots */}
        {salesPoints.map((pt, i) => (
          <circle
            key={`s-${i}`}
            cx={pt.x}
            cy={pt.y}
            r="4"
            fill="#34d399"
            stroke="#0b132b"
            strokeWidth="2"
            style={{ cursor: 'pointer', transition: 'r 0.2s' }}
            onMouseEnter={() => setHoveredPoint({ ...pt, type: 'Sales' })}
            onMouseLeave={() => setHoveredPoint(null)}
          />
        ))}

        {/* Spent Data Dots */}
        {spentPoints.map((pt, i) => (
          <circle
            key={`e-${i}`}
            cx={pt.x}
            cy={pt.y}
            r="4"
            fill="#f87171"
            stroke="#0b132b"
            strokeWidth="2"
            style={{ cursor: 'pointer', transition: 'r 0.2s' }}
            onMouseEnter={() => setHoveredPoint({ ...pt, type: 'Spent' })}
            onMouseLeave={() => setHoveredPoint(null)}
          />
        ))}

        {/* X Axis Month Labels */}
        {trends.map((t, idx) => (
          <text
            key={t.month}
            x={50 + idx * 60}
            y="160"
            fill="#94a3b8"
            fontSize="10"
            textAnchor="middle"
            fontFamily="sans-serif"
          >
            {t.month}
          </text>
        ))}
      </svg>

      {/* Floating Hover Tooltip */}
      {hoveredPoint && (
        <div
          style={{
            position: 'absolute',
            top: `${(hoveredPoint.y / 170) * 100 - 15}%`,
            left: `${(hoveredPoint.x / 380) * 100}%`,
            transform: 'translate(-50%, -100%)',
            background: 'rgba(15, 23, 42, 0.95)',
            border: `1px solid ${hoveredPoint.type === 'Sales' ? '#34d399' : '#f87171'}`,
            padding: '4px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            color: '#ffffff',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            zIndex: 10,
          }}
        >
          <strong>{hoveredPoint.month}:</strong> {hoveredPoint.type} {hoveredPoint.val}
        </div>
      )}
    </div>
  );
};

// Real-Time Categorical Burn Donut Chart
const CategoricalDonutChart = ({ expensesByCategory = {}, totalExpenses = 0 }) => {
  const colorMap = {
    stock: { label: 'Inventory', color: '#2dd4bf' },
    inventory: { label: 'Inventory', color: '#2dd4bf' },
    marketing: { label: 'Marketing', color: '#f87171' },
    rent: { label: 'Rent', color: '#facc15' },
    operations: { label: 'Operations', color: '#3b82f6' },
    payroll: { label: 'Payroll', color: '#e879f9' },
    salary: { label: 'Payroll', color: '#e879f9' },
    electricity: { label: 'Utilities', color: '#fb923c' },
    transport: { label: 'Transport', color: '#38bdf8' },
    other: { label: 'Other', color: '#a855f7' },
  };

  const total = Number(totalExpenses) || 0;

  // Extract non-zero expense items
  const items = Object.entries(expensesByCategory || {})
    .filter(([_, amt]) => Number(amt) > 0)
    .map(([cat, amt]) => {
      const key = cat.toLowerCase();
      const meta = colorMap[key] || {
        label: cat.charAt(0).toUpperCase() + cat.slice(1),
        color: '#38bdf8',
      };
      const amount = Number(amt);
      const percent = total > 0 ? Math.round((amount / total) * 100) : 0;
      return {
        label: meta.label,
        color: meta.color,
        amount,
        percent,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  // If no expense entries recorded yet, show a clean 100% surplus placeholder
  const displayItems = items.length > 0 ? items : [
    { label: 'Zero Expenses (100% Margin)', color: '#34d399', percent: 100, amount: 0 },
  ];

  // SVG circle calculations (circumference = 2 * PI * 38 ≈ 238.76)
  const circumference = 239;
  let accumulatedPercent = 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', gap: '16px' }}>
      {/* Dynamic Donut Graphic */}
      <div style={{ position: 'relative', width: '130px', height: '130px', flexShrink: 0 }}>
        <svg viewBox="0 0 100 100" width="100%" height="100%">
          {displayItems.map((item, idx) => {
            const strokeLength = (item.percent / 100) * circumference;
            const dashArray = `${strokeLength} ${circumference - strokeLength}`;
            const dashOffset = -(accumulatedPercent / 100) * circumference;
            accumulatedPercent += item.percent;

            return (
              <circle
                key={idx}
                cx="50"
                cy="50"
                r="38"
                fill="transparent"
                stroke={item.color}
                strokeWidth="15"
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 0.5s ease' }}
              />
            );
          })}
          {/* Center inner dark cutout circle */}
          <circle cx="50" cy="50" r="28" fill="#0b172e" />
        </svg>
      </div>

      {/* Legend list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, minWidth: 0 }}>
        {displayItems.map((c) => (
          <div key={c.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
              <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: c.color, flexShrink: 0 }} />
              <span style={{ color: '#cbd5e1', fontWeight: 500, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {c.label}
              </span>
            </div>
            <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '11.5px', marginLeft: '6px' }}>
              {c.percent}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const ProfitLoss = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [period, setPeriod] = useState('all');
  const [data, setData] = useState({
    totalSales: 0,
    totalExpenses: 0,
    netProfit: 0,
    recentTransactions: [],
    monthlyTrends: [],
    expensesByCategory: {},
    salesTrendPct: '+0.0%',
    spentTrendPct: '+0.0%',
  });
  const [insightsText, setInsightsText] = useState(
    'Real-time data synchronization is active. All financial flows update automatically.'
  );
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState(null); // 'sales' | 'expenses' | 'profit' | 'addTxn' | null
  const [showInsight, setShowInsight] = useState(true);

  // Fetch real-time live data from MongoDB
  const fetchFinancialData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getDashboardData(period);
      if (res) {
        setData(res);
      }
    } catch (err) {
      console.error('Error fetching realtime dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  // Fetch live AI forecasting insights
  const fetchInsights = useCallback(async () => {
    try {
      const res = await getDashboardInsights();
      if (res && res.summary) {
        setInsightsText(res.summary);
      }
    } catch (e) {
      // Keep sensible fallback
    }
  }, []);

  // Real-Time Event Subscription (SSE live stream - updates automatically upon new payments or transactions)
  useRealtimeEvents({
    onPaymentSuccess: () => {
      fetchFinancialData();
      fetchInsights();
    },
    onSaleCreated: () => {
      fetchFinancialData();
      fetchInsights();
    },
    onExpenseCreated: () => {
      fetchFinancialData();
      fetchInsights();
    },
    onTransactionCreated: () => {
      fetchFinancialData();
      fetchInsights();
    },
    onReconnect: () => {
      fetchFinancialData();
    },
    onAnyEvent: (type) => {
      if (['payment.confirmed', 'sale.finalized', 'expense.recorded'].includes(type)) {
        fetchFinancialData();
        fetchInsights();
      }
    },
  });

  useEffect(() => {
    fetchFinancialData();
    fetchInsights();
  }, [fetchFinancialData, fetchInsights]);

  const periods = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
    { id: 'year', label: 'This Year' },
    { id: 'all', label: 'All' },
  ];

  const salesVal = Number(data.totalSales) || 0;
  const spentVal = Number(data.totalExpenses) || 0;
  const profitVal = data.netProfit !== undefined ? Number(data.netProfit) : (salesVal - spentVal);
  const isProfitable = profitVal >= 0;
  const profitMargin = salesVal > 0 ? ((profitVal / salesVal) * 100).toFixed(1) : (isProfitable ? '100.0' : '0.0');

  // Real database transactions
  const displayTransactions = (data.recentTransactions && data.recentTransactions.length > 0)
    ? data.recentTransactions.slice(0, 5).map((txn, idx) => ({
        id: String(idx).padStart(6, '0'),
        date: new Date(txn.createdAt || Date.now()).toLocaleDateString('en-GB').replace(/\//g, '-'),
        category: txn.category || txn.paymentMethod || (txn.type === 'Sale' ? 'Shop Sale' : 'Expense'),
        amount: `₹${Number(txn.amount || 0).toLocaleString('en-IN')}`,
        isPositive: txn.type === 'Sale' || txn.type === 'Bank Credit',
      }))
    : [];

  return (
    <div className="pl-executive-container">
      {/* ================= TOP HEADER & CONTROLS ================= */}
      <div className="pl-header-toolbar">
        <div className="pl-title-block">
          <h1>Profit &amp; Loss Statement</h1>
          <p>Real-time bottom-line profit margins and categorical burn analysis.</p>
        </div>

        <div className="pl-controls-group">
          {/* Segmented Period Filter Pills */}
          <div className="pl-period-pills">
            {periods.map((p) => (
              <button
                key={p.id}
                className={`pl-period-btn ${period === p.id ? 'active' : ''}`}
                onClick={() => setPeriod(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* + Add Transaction Button */}
          <button className="pl-add-txn-btn" onClick={() => setActiveModal('addTxn')}>
            <Plus size={16} /> Add Transaction
          </button>
        </div>
      </div>

      {/* ================= 3 TOP GLOWING KPI CARDS ================= */}
      <div className="pl-kpi-grid">
        {/* Card 1: TOTAL SALES */}
        <div className="pl-kpi-card pl-card-sales" onClick={() => setActiveModal('sales')}>
          <div className="pl-kpi-card-header">
            <span className="pl-kpi-label">TOTAL SALES</span>
            <div className="pl-kpi-badge-icon" style={{ background: 'rgba(45, 212, 191, 0.15)', color: '#2dd4bf' }}>
              <TrendingUp size={15} />
            </div>
          </div>

          <div className="pl-kpi-body">
            <div className="pl-kpi-value-col">
              <span className="pl-kpi-main-val" style={{ color: '#2dd4bf' }}>
                ₹{salesVal.toLocaleString('en-IN')}
              </span>
              <span className="pl-kpi-trend" style={{ color: '#34d399' }}>
                ↗ {data.salesTrendPct || '+0.0%'} vs last month
              </span>
            </div>
            <Sparkline color="#2dd4bf" type="up" />
          </div>

          <div className="pl-kpi-footer-link">
            <span>Click to see detailed breakdown</span>
            <ChevronRight size={14} />
          </div>
        </div>

        {/* Card 2: TOTAL SPENT */}
        <div className="pl-kpi-card pl-card-spent" onClick={() => setActiveModal('expenses')}>
          <div className="pl-kpi-card-header">
            <span className="pl-kpi-label">TOTAL SPENT</span>
            <div className="pl-kpi-badge-icon" style={{ background: 'rgba(248, 113, 113, 0.15)', color: '#f87171' }}>
              <TrendingDown size={15} />
            </div>
          </div>

          <div className="pl-kpi-body">
            <div className="pl-kpi-value-col">
              <span className="pl-kpi-main-val" style={{ color: '#f87171' }}>
                ₹{spentVal.toLocaleString('en-IN')}
              </span>
              <span className="pl-kpi-trend" style={{ color: '#f87171' }}>
                ↘ {data.spentTrendPct || '+0.0%'} vs last month
              </span>
            </div>
            <Sparkline color="#f87171" type="down" />
          </div>

          <div className="pl-kpi-footer-link">
            <span>Click to see detailed breakdown</span>
            <ChevronRight size={14} />
          </div>
        </div>

        {/* Card 3: NET PROFIT */}
        <div className="pl-kpi-card pl-card-profit" onClick={() => setActiveModal('profit')}>
          <div className="pl-kpi-card-header">
            <span className="pl-kpi-label">NET PROFIT</span>
            <div className="pl-kpi-badge-icon" style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#34d399' }}>
              <Clock size={15} />
            </div>
          </div>

          <div className="pl-kpi-body">
            <div className="pl-kpi-value-col">
              <span className="pl-kpi-main-val" style={{ color: isProfitable ? '#34d399' : '#f87171' }}>
                {profitVal < 0 ? '-' : ''}₹{Math.abs(profitVal).toLocaleString('en-IN')}
              </span>
              <div
                className="pl-margin-pill"
                style={{
                  background: isProfitable ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  borderColor: isProfitable ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)',
                  color: isProfitable ? '#34d399' : '#f87171',
                }}
              >
                <span>● {profitMargin}% {isProfitable ? 'Margin Profitable' : 'Margin Deficit'}</span>
              </div>
            </div>
            <Sparkline color={isProfitable ? '#34d399' : '#f87171'} type={isProfitable ? 'up' : 'down'} />
          </div>

          <div className="pl-kpi-footer-link">
            <span>Click for full breakdown</span>
            <ChevronRight size={14} />
          </div>
        </div>
      </div>

      {/* ================= BOTTOM 3 SECTIONS GRID ================= */}
      <div className="pl-bottom-grid">
        {/* Section 1: Monthly Trends (Double-width Card) */}
        <div className="pl-panel-card">
          <div className="pl-panel-header">
            <div className="pl-panel-title-wrap">
              <h3>Monthly Trends</h3>
              <p>Real-Time Cash Flows</p>
            </div>
            <div className="pl-chart-legend">
              <div className="pl-legend-item">
                <span className="pl-legend-dot" style={{ backgroundColor: '#34d399', boxShadow: '0 0 6px #34d399' }} />
                <span style={{ color: '#cbd5e1' }}>Sales</span>
              </div>
              <div className="pl-legend-item">
                <span className="pl-legend-dot" style={{ backgroundColor: '#f87171', boxShadow: '0 0 6px #f87171' }} />
                <span style={{ color: '#cbd5e1' }}>Spent</span>
              </div>
            </div>
          </div>

          <MonthlyTrendsChart monthlyTrends={data.monthlyTrends} />
        </div>

        {/* Section 2: Spent breakdown (Categorical Burn Analysis) */}
        <div className="pl-panel-card">
          <div className="pl-panel-header">
            <div className="pl-panel-title-wrap">
              <h3>Spent breakdown</h3>
              <p>Categorical Burn Analysis</p>
            </div>
          </div>

          <CategoricalDonutChart
            expensesByCategory={data.expensesByCategory}
            totalExpenses={spentVal}
          />
        </div>

        {/* Section 3: Recent Transactions */}
        <div className="pl-panel-card">
          <div className="pl-panel-header">
            <div className="pl-panel-title-wrap">
              <h3>Recent Transactions</h3>
            </div>
          </div>

          <div className="pl-table-wrap">
            {displayTransactions.length > 0 ? (
              <table className="pl-table">
                <thead>
                  <tr>
                    <th>Transaction ID</th>
                    <th>Date</th>
                    <th>Category</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {displayTransactions.map((tx) => (
                    <tr key={tx.id}>
                      <td>
                        <span className="pl-status-check">
                          <Check size={11} strokeWidth={3} />
                        </span>
                        <span>{tx.id}</span>
                      </td>
                      <td>{tx.date}</td>
                      <td>{tx.category}</td>
                      <td style={{ textAlign: 'right' }}>
                        <span className={tx.isPositive ? 'pl-amount-badge-green' : 'pl-amount-badge-red'}>
                          {tx.amount}
                          {tx.isPositive && (
                            <span style={{ width: '13px', height: '13px', borderRadius: '50%', background: 'rgba(52,211,153,0.2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Check size={9} />
                            </span>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ textAlign: 'center', padding: '36px 12px', color: '#64748b', fontSize: '13px' }}>
                No recorded transactions for this period.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================= FLOATING AI INSIGHTS WIDGET ================= */}
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

      {/* ================= MODAL: QUICK ADD TRANSACTION ================= */}
      {activeModal === 'addTxn' && (
        <div className="modal-backdrop-sleek" onClick={() => setActiveModal(null)}>
          <div className="pl-dark-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#ffffff' }}>Add New Transaction</h3>
              <button
                onClick={() => setActiveModal(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '24px' }}>
              Choose whether you are recording incoming revenue or outgoing expenses:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <button
                className="smart-auth-btn"
                style={{ background: 'linear-gradient(180deg, #10b981 0%, #059669 100%)', boxShadow: '0 4px 14px rgba(16,185,129,0.4)' }}
                onClick={() => navigate('/add-sale')}
              >
                <ArrowUpRight size={16} /> Record Sale (Inflow)
              </button>
              <button
                className="smart-auth-btn"
                style={{ background: 'linear-gradient(180deg, #ef4444 0%, #dc2626 100%)', boxShadow: '0 4px 14px rgba(239,68,68,0.4)' }}
                onClick={() => navigate('/expenses')}
              >
                <ArrowDownRight size={16} /> Record Expense (Outflow)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: SALES BREAKDOWN ================= */}
      {activeModal === 'sales' && (
        <div className="modal-backdrop-sleek" onClick={() => setActiveModal(null)}>
          <div className="pl-dark-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Banknote size={20} color="#2dd4bf" />
                <h3 style={{ margin: 0, fontSize: '18px' }}>Sales Breakdown by Payment Channel</h3>
              </div>
              <button onClick={() => setActiveModal(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div className="pl-dark-modal-row">
              <span style={{ color: '#94a3b8' }}>💵 Cash at Counter</span>
              <strong>₹{(data.salesByPaymentMethod?.cash || 0).toLocaleString('en-IN')}</strong>
            </div>
            <div className="pl-dark-modal-row">
              <span style={{ color: '#94a3b8' }}>📱 Google Pay (GPay)</span>
              <strong>₹{(data.salesByPaymentMethod?.gpay || 0).toLocaleString('en-IN')}</strong>
            </div>
            <div className="pl-dark-modal-row">
              <span style={{ color: '#94a3b8' }}>📱 PhonePe / UPI</span>
              <strong>₹{(data.salesByPaymentMethod?.phonepe || 0).toLocaleString('en-IN')}</strong>
            </div>
            <div className="pl-dark-modal-row">
              <span style={{ color: '#94a3b8' }}>⚡ Other UPI VPAs</span>
              <strong>₹{(data.salesByPaymentMethod?.otherUpi || 0).toLocaleString('en-IN')}</strong>
            </div>
            <div className="pl-dark-modal-row">
              <span style={{ color: '#94a3b8' }}>💳 Card / POS</span>
              <strong>₹{(data.salesByPaymentMethod?.card || 0).toLocaleString('en-IN')}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '8px', background: 'rgba(45,212,191,0.15)', border: '1px solid rgba(45,212,191,0.3)', marginTop: '12px', color: '#2dd4bf', fontWeight: 800 }}>
              <span>Total Recognized Sales</span>
              <span>₹{salesVal.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: EXPENSES BREAKDOWN ================= */}
      {activeModal === 'expenses' && (
        <div className="modal-backdrop-sleek" onClick={() => setActiveModal(null)}>
          <div className="pl-dark-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Briefcase size={20} color="#f87171" />
                <h3 style={{ margin: 0, fontSize: '18px' }}>Operating Expenses Breakdown</h3>
              </div>
              <button onClick={() => setActiveModal(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {data.expensesByCategory && Object.keys(data.expensesByCategory).length > 0 ? (
              Object.entries(data.expensesByCategory).map(([cat, amt]) => (
                <div key={cat} className="pl-dark-modal-row">
                  <span style={{ color: '#94a3b8', textTransform: 'capitalize' }}>{cat}</span>
                  <strong>₹{Number(amt || 0).toLocaleString('en-IN')}</strong>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '16px', color: '#64748b' }}>
                No categorical expenses recorded in this period.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '8px', background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)', marginTop: '12px', color: '#f87171', fontWeight: 800 }}>
              <span>Total Spent</span>
              <span>₹{spentVal.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: NET MARGIN PERFORMANCE ================= */}
      {activeModal === 'profit' && (
        <div className="modal-backdrop-sleek" onClick={() => setActiveModal(null)}>
          <div className="pl-dark-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PieChart size={20} color={isProfitable ? '#34d399' : '#f87171'} />
                <h3 style={{ margin: 0, fontSize: '18px' }}>Net Margin Performance</h3>
              </div>
              <button onClick={() => setActiveModal(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div className="pl-dark-modal-row">
              <span style={{ color: '#94a3b8' }}>Total Inflow (Sales)</span>
              <strong style={{ color: '#34d399' }}>+ ₹{salesVal.toLocaleString('en-IN')}</strong>
            </div>
            <div className="pl-dark-modal-row">
              <span style={{ color: '#94a3b8' }}>Total Outflow (Spent)</span>
              <strong style={{ color: '#f87171' }}>- ₹{spentVal.toLocaleString('en-IN')}</strong>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: '8px',
                background: isProfitable ? 'rgba(52,211,153,0.15)' : 'rgba(239,68,68,0.15)',
                border: `1px solid ${isProfitable ? 'rgba(52,211,153,0.3)' : 'rgba(239,68,68,0.3)'}`,
                marginTop: '12px',
                color: isProfitable ? '#34d399' : '#f87171',
                fontWeight: 800,
              }}
            >
              <span>Net Profit Margin ({profitMargin}%)</span>
              <span>{profitVal < 0 ? '-' : ''}₹{Math.abs(profitVal).toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfitLoss;
