import React, { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { getDashboardData } from '../services/api';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  ChevronRight,
  X,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

const ProfitLoss = () => {
  const { t } = useLanguage();

  const [period, setPeriod] = useState('month'); // 'today', 'week', 'month', 'year', 'all'
  const [data, setData] = useState({
    totalSales: 0,
    totalExpenses: 0,
    netProfit: 0,
    salesByPaymentMethod: { cash: 0, upi: 0, card: 0 },
    expensesByCategory: { stock: 0, rent: 0, electricity: 0, salary: 0, transport: 0, other: 0 },
  });
  const [loading, setLoading] = useState(true);

  // Modal State for breakdowns
  const [activeModal, setActiveModal] = useState(null); // 'sales' | 'expenses' | null

  useEffect(() => {
    fetchFinancialData();
  }, [period]);

  const fetchFinancialData = async () => {
    try {
      setLoading(true);
      const res = await getDashboardData(period);
      setData(res);
    } catch (err) {
      console.error('Error fetching profit/loss data:', err);
    } finally {
      setLoading(false);
    }
  };

  const isProfit = data.netProfit >= 0;

  const periods = [
    { id: 'today', labelKey: 'today' },
    { id: 'week', labelKey: 'thisWeek' },
    { id: 'month', labelKey: 'thisMonth' },
    { id: 'year', labelKey: 'thisYear' },
    { id: 'all', labelKey: 'all' },
  ];

  return (
    <div className="section-page-container">
      {/* Top Header & Period Selector */}
      <div className="page-intro-bar">
        <div>
          <h2 className="section-title">{t('navProfitLoss')} Statement</h2>
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
              {t(p.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* 3 Compact KPI Cards */}
      <div className="pnl-compact-grid">
        {/* Total Sales */}
        <div
          className="sleek-panel pnl-card-interactive"
          onClick={() => setActiveModal('sales')}
        >
          <div className="panel-header-compact">
            <span className="kpi-label">{t('totalSales')}</span>
            <div className="kpi-icon-badge bg-profit-soft">
              <TrendingUp size={16} className="text-profit" />
            </div>
          </div>
          <div className="pnl-amount-display text-profit">
            ₹{data.totalSales.toLocaleString('en-IN')}
          </div>
          <div className="pnl-footer-action">
            <span>{t('clickToSeeBreakdown')}</span>
            <ChevronRight size={14} />
          </div>
        </div>

        {/* Total Expenses */}
        <div
          className="sleek-panel pnl-card-interactive"
          onClick={() => setActiveModal('expenses')}
        >
          <div className="panel-header-compact">
            <span className="kpi-label">{t('totalSpent')}</span>
            <div className="kpi-icon-badge bg-loss-soft">
              <TrendingDown size={16} className="text-loss" />
            </div>
          </div>
          <div className="pnl-amount-display text-loss">
            ₹{data.totalExpenses.toLocaleString('en-IN')}
          </div>
          <div className="pnl-footer-action">
            <span>{t('clickToSeeBreakdown')}</span>
            <ChevronRight size={14} />
          </div>
        </div>

        {/* Net Profit / Loss */}
        <div className={`sleek-panel pnl-card-net ${isProfit ? 'border-net-profit' : 'border-net-loss'}`}>
          <div className="panel-header-compact">
            <span className="kpi-label">{isProfit ? t('netProfit') : t('netLoss')}</span>
            <div className={`kpi-icon-badge ${isProfit ? 'bg-profit-soft' : 'bg-loss-soft'}`}>
              <PieChart size={16} className={isProfit ? 'text-profit' : 'text-loss'} />
            </div>
          </div>
          <div className={`pnl-amount-display ${isProfit ? 'text-profit' : 'text-loss'}`}>
            ₹{data.netProfit.toLocaleString('en-IN')}
          </div>
          <div className="pnl-footer-action">
            <span className={`status-micro-pill ${isProfit ? 'pill-profit' : 'pill-loss'}`}>
              {isProfit ? `● Margin Profitable` : `● Operational Deficit`}
            </span>
          </div>
        </div>
      </div>

      {/* Breakdown Modal — Sales */}
      {activeModal === 'sales' && (
        <div className="modal-overlay-blur" onClick={() => setActiveModal(null)}>
          <div className="sleek-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-compact">
              <div>
                <h3 className="panel-heading">{t('salesBreakdown')}</h3>
                <span className="panel-subheading">Inflow classified by payment instrument</span>
              </div>
              <button className="btn-close-modal" onClick={() => setActiveModal(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-breakdown-list">
              <div className="modal-breakdown-row">
                <span className="bd-label">{t('cash')}</span>
                <strong className="bd-val">₹{(data.salesByPaymentMethod?.cash || 0).toLocaleString('en-IN')}</strong>
              </div>

              <div className="modal-breakdown-row">
                <span className="bd-label">{t('upi')}</span>
                <strong className="bd-val">₹{(data.salesByPaymentMethod?.upi || 0).toLocaleString('en-IN')}</strong>
              </div>

              <div className="modal-breakdown-row">
                <span className="bd-label">{t('card')}</span>
                <strong className="bd-val">₹{(data.salesByPaymentMethod?.card || 0).toLocaleString('en-IN')}</strong>
              </div>

              <div className="modal-breakdown-row row-total">
                <span>TOTAL REVENUE</span>
                <strong className="text-profit">₹{data.totalSales.toLocaleString('en-IN')}</strong>
              </div>
            </div>

            <button className="sleek-btn-secondary w-full" onClick={() => setActiveModal(null)}>
              {t('close')}
            </button>
          </div>
        </div>
      )}

      {/* Breakdown Modal — Expenses */}
      {activeModal === 'expenses' && (
        <div className="modal-overlay-blur" onClick={() => setActiveModal(null)}>
          <div className="sleek-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-compact">
              <div>
                <h3 className="panel-heading">{t('expenseBreakdown')}</h3>
                <span className="panel-subheading">Outflow distributed across spending categories</span>
              </div>
              <button className="btn-close-modal" onClick={() => setActiveModal(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-breakdown-list">
              <div className="modal-breakdown-row">
                <span className="bd-label">{t('categoryStock')}</span>
                <strong className="bd-val">₹{(data.expensesByCategory?.stock || 0).toLocaleString('en-IN')}</strong>
              </div>

              <div className="modal-breakdown-row">
                <span className="bd-label">{t('categoryRent')}</span>
                <strong className="bd-val">₹{(data.expensesByCategory?.rent || 0).toLocaleString('en-IN')}</strong>
              </div>

              <div className="modal-breakdown-row">
                <span className="bd-label">{t('categoryElectricity')}</span>
                <strong className="bd-val">₹{(data.expensesByCategory?.electricity || 0).toLocaleString('en-IN')}</strong>
              </div>

              <div className="modal-breakdown-row">
                <span className="bd-label">{t('categorySalary')}</span>
                <strong className="bd-val">₹{(data.expensesByCategory?.salary || 0).toLocaleString('en-IN')}</strong>
              </div>

              <div className="modal-breakdown-row">
                <span className="bd-label">{t('categoryTransport')}</span>
                <strong className="bd-val">₹{(data.expensesByCategory?.transport || 0).toLocaleString('en-IN')}</strong>
              </div>

              <div className="modal-breakdown-row">
                <span className="bd-label">{t('categoryOther')}</span>
                <strong className="bd-val">₹{(data.expensesByCategory?.other || 0).toLocaleString('en-IN')}</strong>
              </div>

              <div className="modal-breakdown-row row-total">
                <span>TOTAL EXPENDITURE</span>
                <strong className="text-loss">₹{data.totalExpenses.toLocaleString('en-IN')}</strong>
              </div>
            </div>

            <button className="sleek-btn-secondary w-full" onClick={() => setActiveModal(null)}>
              {t('close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfitLoss;
