import React, { useEffect, useState, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { getDashboardData } from '../services/api';
import useRealtimeEvents from '../hooks/useRealtimeEvents';
import {
  TrendingUp,
  TrendingDown,
  ChevronRight,
  X,
  PieChart,
  Banknote,
  Briefcase,
} from 'lucide-react';

const ProfitLoss = () => {
  const { t } = useLanguage();

  const [period, setPeriod] = useState('all'); // 'today', 'week', 'month', 'year', 'all'
  const [data, setData] = useState({
    totalSales: 0,
    salesRevenue: 0,
    costOfGoodsSold: 0,
    grossProfit: 0,
    totalExpenses: 0,
    operatingExpenses: 0,
    netProfit: 0,
    cashTotal: 0,
    digitalTotal: 0,
    salesByPaymentMethod: { cash: 0, upi: 0, gpay: 0, phonepe: 0, otherUpi: 0, card: 0 },
    expensesByCategory: { stock: 0, rent: 0, electricity: 0, salary: 0, transport: 0, other: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState(null); // 'sales' | 'expenses' | 'profit' | null

  const fetchFinancialData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getDashboardData(period);
      setData(res || {});
    } catch (err) {
      console.error('Error fetching profit/loss data:', err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  // Real-Time Event Subscription (No polling!)
  useRealtimeEvents({
    onPaymentSuccess: () => fetchFinancialData(),
    onSaleCreated: () => fetchFinancialData(),
    onExpenseCreated: () => fetchFinancialData(),
    onTransactionCreated: () => fetchFinancialData(),
    onReconnect: () => fetchFinancialData(),
    onAnyEvent: (type) => {
      if (['payment.confirmed', 'sale.finalized', 'expense.recorded', 'refund.processed'].includes(type)) {
        fetchFinancialData();
      }
    },
  });

  useEffect(() => {
    fetchFinancialData();
  }, [fetchFinancialData]);

  const isProfit = (data.netProfit || 0) >= 0;

  const periods = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
    { id: 'year', label: 'This Year' },
    { id: 'all', label: 'All' },
  ];

  return (
    <div className="section-page-container">
      {/* Top Header & Period Selector */}
      <div className="page-intro-bar">
        <div>
          <h2 className="section-title">Profit & Loss Statement</h2>
          <p className="section-subtitle">Real-time bottom-line profit margins and categorical burn analysis</p>
        </div>

        {/* Compact Period Selector */}
        <div className="mini-segmented-control">
          {periods.map((p) => (
            <button
              key={p.id}
              className={`mini-segment-btn ${period === p.id ? 'active' : ''}`}
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3 Core Minimal KPI Cards (Matching user layout) */}
      <div className="pl-cards-row">
        {/* Card 1: TOTAL SALES */}
        <div className="pl-card" onClick={() => setActiveModal('sales')}>
          <div className="pl-card-top">
            <span className="pl-card-label">TOTAL SALES</span>
            <div className="pl-icon-badge pl-icon-green">
              <TrendingUp size={15} />
            </div>
          </div>
          <div className="pl-card-amount pl-amount-green">
            ₹{(data.totalSales || 0).toLocaleString('en-IN')}
          </div>
          <div className="pl-card-footer">
            <span className="pl-card-subtext">Click to see detailed breakdown</span>
            <ChevronRight size={15} className="pl-chevron" />
          </div>
        </div>

        {/* Card 2: TOTAL SPENT */}
        <div className="pl-card" onClick={() => setActiveModal('expenses')}>
          <div className="pl-card-top">
            <span className="pl-card-label">TOTAL SPENT</span>
            <div className="pl-icon-badge pl-icon-red">
              <TrendingDown size={15} />
            </div>
          </div>
          <div className="pl-card-amount pl-amount-red">
            ₹{(data.totalExpenses || 0).toLocaleString('en-IN')}
          </div>
          <div className="pl-card-footer">
            <span className="pl-card-subtext">Click to see detailed breakdown</span>
            <ChevronRight size={15} className="pl-chevron" />
          </div>
        </div>

        {/* Card 3: NET PROFIT */}
        <div className="pl-card" onClick={() => setActiveModal('profit')}>
          <div className="pl-card-top">
            <span className="pl-card-label">NET PROFIT</span>
            <div className={`pl-icon-badge ${isProfit ? 'pl-icon-green' : 'pl-icon-red'}`}>
              <PieChart size={15} />
            </div>
          </div>
          <div className={`pl-card-amount ${isProfit ? 'pl-amount-green' : 'pl-amount-red'}`}>
            ₹{Math.abs(data.netProfit || 0).toLocaleString('en-IN')}
          </div>
          <div className="pl-card-footer">
            <span className={`pl-margin-chip ${isProfit ? 'pl-chip-green' : 'pl-chip-red'}`}>
              ● {isProfit ? 'Margin Profitable' : 'Margin Loss'}
            </span>
          </div>
        </div>
      </div>

      {/* Modal: Sales Payment Method Breakdown */}
      {activeModal === 'sales' && (
        <div className="modal-backdrop-sleek" onClick={() => setActiveModal(null)}>
          <div className="sleek-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex-align-gap">
                <Banknote size={18} className="text-emerald" />
                <h3>Sales Breakdown by Payment Channel</h3>
              </div>
              <button className="close-btn" onClick={() => setActiveModal(null)}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#f8fafc', borderRadius: '6px' }}>
                <span>💵 Cash at Counter</span>
                <strong>₹{(data.salesByPaymentMethod?.cash || 0).toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#f8fafc', borderRadius: '6px' }}>
                <span>📱 Google Pay (GPay)</span>
                <strong>₹{(data.salesByPaymentMethod?.gpay || 0).toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#f8fafc', borderRadius: '6px' }}>
                <span>📱 PhonePe</span>
                <strong>₹{(data.salesByPaymentMethod?.phonepe || 0).toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#f8fafc', borderRadius: '6px' }}>
                <span>⚡ Other UPI VPAs</span>
                <strong>₹{(data.salesByPaymentMethod?.otherUpi || 0).toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#f8fafc', borderRadius: '6px' }}>
                <span>💳 Card / POS</span>
                <strong>₹{(data.salesByPaymentMethod?.card || 0).toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#ecfdf5', borderRadius: '6px', fontWeight: 700, color: '#059669' }}>
                <span>Total Recognized Sales</span>
                <strong>₹{(data.totalSales || 0).toLocaleString('en-IN')}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Operating Expenses Breakdown */}
      {activeModal === 'expenses' && (
        <div className="modal-backdrop-sleek" onClick={() => setActiveModal(null)}>
          <div className="sleek-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex-align-gap">
                <Briefcase size={18} className="text-amber" />
                <h3>Operating Expenses Breakdown</h3>
              </div>
              <button className="close-btn" onClick={() => setActiveModal(null)}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
              {data.expensesByCategory && Object.keys(data.expensesByCategory).length > 0 ? (
                Object.entries(data.expensesByCategory).map(([cat, amt]) => (
                  <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#f8fafc', borderRadius: '6px' }}>
                    <span style={{ textTransform: 'capitalize' }}>{cat}</span>
                    <strong>₹{(amt || 0).toLocaleString('en-IN')}</strong>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '16px', color: '#64748b' }}>No categorical expenses recorded in this period.</div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#fee2e2', borderRadius: '6px', fontWeight: 700, color: '#dc2626' }}>
                <span>Total Spent</span>
                <strong>₹{(data.totalExpenses || 0).toLocaleString('en-IN')}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Net Margin Performance Breakdown */}
      {activeModal === 'profit' && (
        <div className="modal-backdrop-sleek" onClick={() => setActiveModal(null)}>
          <div className="sleek-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex-align-gap">
                <PieChart size={18} className={isProfit ? 'text-emerald' : 'text-loss'} />
                <h3>Net Margin Performance</h3>
              </div>
              <button className="close-btn" onClick={() => setActiveModal(null)}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#f8fafc', borderRadius: '6px' }}>
                <span>Total Inflow (Sales)</span>
                <strong className="text-profit">₹{(data.totalSales || 0).toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#f8fafc', borderRadius: '6px' }}>
                <span>Total Outflow (Expenses)</span>
                <strong className="text-loss">- ₹{(data.totalExpenses || 0).toLocaleString('en-IN')}</strong>
              </div>
              {Boolean(data.costOfGoodsSold) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#f8fafc', borderRadius: '6px' }}>
                  <span>Cost of Goods Sold (COGS)</span>
                  <strong>- ₹{(data.costOfGoodsSold || 0).toLocaleString('en-IN')}</strong>
                </div>
              )}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px',
                background: isProfit ? '#ecfdf5' : '#fee2e2',
                borderRadius: '6px',
                fontWeight: 800,
                color: isProfit ? '#059669' : '#dc2626'
              }}>
                <span>Net Margin ({isProfit ? 'Surplus' : 'Deficit'})</span>
                <strong>₹{Math.abs(data.netProfit || 0).toLocaleString('en-IN')}</strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfitLoss;
