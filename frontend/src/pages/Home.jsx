import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { getDashboardData } from '../services/api';
import { PlusCircle, MinusCircle, TrendingUp, TrendingDown, DollarSign, Wallet, CreditCard, ArrowRight } from 'lucide-react';

const Home = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [data, setData] = useState({
    totalSales: 0,
    totalExpenses: 0,
    netProfit: 0,
    cashSales: 0,
    upiSales: 0,
    cardSales: 0,
    todaySales: 0,
    todayExpenses: 0,
    todayProfit: 0,
    recentTransactions: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await getDashboardData();
      setData(res);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const isProfit = data.netProfit >= 0;

  return (
    <div className="page-container">
      {/* 3 Main Summary Cards */}
      <section className="main-cards-grid">
        {/* Total Sales */}
        <div className="stat-card sales-card">
          <div className="card-header">
            <h3>{t('totalSales')}</h3>
            <TrendingUp size={28} className="icon-green" />
          </div>
          <div className="card-amount">₹{data.totalSales.toLocaleString('en-IN')}</div>
        </div>

        {/* Total Expenses */}
        <div className="stat-card expenses-card">
          <div className="card-header">
            <h3>{t('totalExpenses')}</h3>
            <TrendingDown size={28} className="icon-red" />
          </div>
          <div className="card-amount">₹{data.totalExpenses.toLocaleString('en-IN')}</div>
        </div>

        {/* Net Profit / Loss */}
        <div className={`stat-card profit-card ${isProfit ? 'profit-bg' : 'loss-bg'}`}>
          <div className="card-header">
            <h3>{isProfit ? t('netProfit') : t('netLoss')}</h3>
            <span className={`status-badge ${isProfit ? 'badge-profit' : 'badge-loss'}`}>
              {isProfit ? t('profit') : t('loss')}
            </span>
          </div>
          <div className={`card-amount ${isProfit ? 'text-profit' : 'text-loss'}`}>
            ₹{data.netProfit.toLocaleString('en-IN')}
          </div>
        </div>
      </section>

      {/* 2 Large Action Buttons */}
      <section className="quick-actions-section">
        <button className="large-btn btn-add-sale" onClick={() => navigate('/add-sale')}>
          <PlusCircle size={32} />
          <span>+ {t('addSale')}</span>
        </button>

        <button className="large-btn btn-add-expense" onClick={() => navigate('/add-expense')}>
          <MinusCircle size={32} />
          <span>+ {t('addExpense')}</span>
        </button>
      </section>

      {/* Today's Summary & Payment Breakdown */}
      <div className="dashboard-sub-grid">
        {/* Today's Summary */}
        <div className="info-panel">
          <h2>{t('todaySummary')}</h2>
          <div className="info-rows">
            <div className="info-row">
              <span>{t('todaySales')}</span>
              <strong className="text-profit">₹{data.todaySales.toLocaleString('en-IN')}</strong>
            </div>
            <div className="info-row">
              <span>{t('todayExpenses')}</span>
              <strong className="text-loss">₹{data.todayExpenses.toLocaleString('en-IN')}</strong>
            </div>
            <div className="info-row highlight-row">
              <span>{t('todayProfitLoss')}</span>
              <strong className={data.todayProfit >= 0 ? 'text-profit' : 'text-loss'}>
                ₹{data.todayProfit.toLocaleString('en-IN')}
              </strong>
            </div>
          </div>
        </div>

        {/* Payment Summary */}
        <div className="info-panel">
          <h2>{t('paymentSummary')}</h2>
          <div className="payment-breakdown">
            <div className="payment-item">
              <DollarSign size={24} className="pay-icon cash-color" />
              <div>
                <span>{t('cashSales')}</span>
                <strong>₹{data.cashSales.toLocaleString('en-IN')}</strong>
              </div>
            </div>

            <div className="payment-item">
              <Wallet size={24} className="pay-icon upi-color" />
              <div>
                <span>{t('upiSales')}</span>
                <strong>₹{data.upiSales.toLocaleString('en-IN')}</strong>
              </div>
            </div>

            <div className="payment-item">
              <CreditCard size={24} className="pay-icon card-color" />
              <div>
                <span>{t('cardSales')}</span>
                <strong>₹{data.cardSales.toLocaleString('en-IN')}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions Section */}
      <section className="info-panel recent-panel">
        <div className="panel-header">
          <h2>{t('recentTransactions')}</h2>
          <button className="view-all-link" onClick={() => navigate('/history')}>
            <span>{t('all')}</span>
            <ArrowRight size={20} />
          </button>
        </div>

        {data.recentTransactions.length === 0 ? (
          <p className="empty-msg">{t('noTransactions')}</p>
        ) : (
          <div className="transaction-list">
            {data.recentTransactions.map((tx) => (
              <div key={tx.id} className="tx-item">
                <div className="tx-left">
                  <span className={`tx-type-tag ${tx.type === 'Sale' ? 'tag-sale' : 'tag-expense'}`}>
                    {tx.type === 'Sale' ? t('sales') : t('expenses')}
                  </span>
                  <div>
                    <strong className="tx-detail">{tx.detail}</strong>
                    {tx.description && <span className="tx-desc"> - {tx.description}</span>}
                  </div>
                </div>
                <div className="tx-right">
                  <span className={`tx-amount ${tx.type === 'Sale' ? 'text-profit' : 'text-loss'}`}>
                    {tx.type === 'Sale' ? '+ ' : '- '}₹{tx.amount.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Home;
