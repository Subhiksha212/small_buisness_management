import React, { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { getSales, getExpenses, deleteSale, deleteExpense } from '../services/api';
import {
  Trash2,
  Filter,
  Calendar,
  Layers,
  Search,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  ReceiptText,
} from 'lucide-react';

const Transactions = () => {
  const { t } = useLanguage();

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Filters
  const [typeFilter, setTypeFilter] = useState('All'); // 'All', 'Sales', 'Expenses'
  const [entryFilter, setEntryFilter] = useState('All'); // 'All', 'Manual', 'Automatic', 'Scanned'
  const [timeFilter, setTimeFilter] = useState('All Time'); // 'Today', 'This Week', 'This Month', 'This Year', 'All Time'

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [salesData, expensesData] = await Promise.all([getSales(), getExpenses()]);

      const formattedSales = salesData.map((s) => ({
        id: s._id,
        rawId: s._id,
        type: 'Sale',
        detail: s.description || (s.entryMethod === 'automatic' ? `${s.provider || 'UPI'} Payment` : 'Shop Sale'),
        paymentMethod: s.paymentMethod,
        upiApp: s.upiApp || s.provider,
        utrNumber: s.utrNumber,
        entryMethod: s.entryMethod || 'manual',
        paymentStatus: s.paymentStatus || 'recorded',
        amount: s.amount,
        createdAt: s.createdAt,
      }));

      const formattedExpenses = expensesData.map((e) => ({
        id: e._id,
        rawId: e._id,
        type: 'Expense',
        detail: e.description || e.category,
        paymentMethod: e.paymentMethod || 'Cash',
        upiApp: e.upiApp || e.provider,
        utrNumber: e.utrNumber,
        entryMethod: e.entryMethod || 'manual',
        paymentStatus: e.paymentStatus || 'recorded',
        amount: e.amount,
        createdAt: e.createdAt,
      }));

      const combined = [...formattedSales, ...formattedExpenses].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );

      setTransactions(combined);
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (tx) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;

    try {
      if (tx.type === 'Sale') {
        await deleteSale(tx.rawId);
      } else {
        await deleteExpense(tx.rawId);
      }
      setTransactions((prev) => prev.filter((item) => item.id !== tx.id));
    } catch (err) {
      alert('Failed to delete transaction.');
    }
  };

  // Filter Logic
  const filteredTransactions = transactions.filter((tx) => {
    if (typeFilter === 'Sales' && tx.type !== 'Sale') return false;
    if (typeFilter === 'Expenses' && tx.type !== 'Expense') return false;

    if (entryFilter === 'Manual' && tx.entryMethod !== 'manual') return false;
    if (entryFilter === 'Automatic' && tx.entryMethod !== 'automatic') return false;
    if (entryFilter === 'Scanned' && tx.entryMethod !== 'scanned') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchDetail = tx.detail?.toLowerCase().includes(q);
      const matchMethod = tx.paymentMethod?.toLowerCase().includes(q);
      const matchAmount = tx.amount?.toString().includes(q);
      if (!matchDetail && !matchMethod && !matchAmount) return false;
    }

    const txDate = new Date(tx.createdAt);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (timeFilter === 'Today') {
      if (txDate < startOfToday) return false;
    } else if (timeFilter === 'This Week') {
      const startOfWeek = new Date(startOfToday);
      startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
      if (txDate < startOfWeek) return false;
    } else if (timeFilter === 'This Month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      if (txDate < startOfMonth) return false;
    } else if (timeFilter === 'This Year') {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      if (txDate < startOfYear) return false;
    }

    return true;
  });

  // Calculate totals for filtered transactions
  const totalFilteredSales = filteredTransactions
    .filter((t) => t.type === 'Sale')
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalFilteredExpenses = filteredTransactions
    .filter((t) => t.type === 'Expense')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="section-page-container">
      {/* Page Title & Breadcrumb */}
      <div className="page-intro-bar">
        <div>
          <h2 className="section-title">{t('navTransactions')}</h2>
          <p className="section-subtitle">Real-time ledger of retail receipts, operational invoices, and webhooks</p>
        </div>

        {/* Live Filter Totals Badge */}
        <div className="summary-pill-group">
          <div className="sum-pill sum-profit">
            <span>Inflow:</span>
            <strong>+₹{totalFilteredSales.toLocaleString('en-IN')}</strong>
          </div>
          <div className="sum-pill sum-loss">
            <span>Outflow:</span>
            <strong>-₹{totalFilteredExpenses.toLocaleString('en-IN')}</strong>
          </div>
        </div>
      </div>

      {/* COMPACT UNIFIED TOOLBAR */}
      <div className="sleek-panel toolbar-panel">
        <div className="toolbar-flex">
          {/* Search Input */}
          <div className="search-box-compact">
            <Search size={14} className="search-icon-dim" />
            <input
              type="text"
              placeholder="Search records by name, amount, or payment method..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input-field"
            />
          </div>

          {/* Filter Pills */}
          <div className="filters-strip">
            {/* Type */}
            <div className="mini-filter-group">
              <span className="filter-tag-title">Type:</span>
              <div className="mini-segmented-control">
                {['All', 'Sales', 'Expenses'].map((type) => (
                  <button
                    key={type}
                    className={`mini-segment-btn ${typeFilter === type ? 'active' : ''}`}
                    onClick={() => setTypeFilter(type)}
                  >
                    {t(type.toLowerCase()) || type}
                  </button>
                ))}
              </div>
            </div>

            {/* Source */}
            <div className="mini-filter-group">
              <span className="filter-tag-title">Source:</span>
              <div className="mini-segmented-control">
                {['All', 'Manual', 'Automatic', 'Scanned'].map((source) => (
                  <button
                    key={source}
                    className={`mini-segment-btn ${entryFilter === source ? 'active' : ''}`}
                    onClick={() => setEntryFilter(source)}
                  >
                    {t(source.toLowerCase()) || source}
                  </button>
                ))}
              </div>
            </div>

            {/* Time */}
            <div className="mini-filter-group">
              <span className="filter-tag-title">Period:</span>
              <div className="mini-segmented-control">
                {['Today', 'This Month', 'All Time'].map((time) => (
                  <button
                    key={time}
                    className={`mini-segment-btn ${timeFilter === time ? 'active' : ''}`}
                    onClick={() => setTimeFilter(time)}
                  >
                    {time === 'This Month' ? t('thisMonth') : time === 'Today' ? t('today') : t('all')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TABLE PANEL */}
      <div className="sleek-panel table-card-compact">
        {loading ? (
          <div className="empty-sub-state">
            <p>Loading ledger entries...</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="empty-state-compact">
            <div className="empty-icon-circle">
              <ReceiptText size={22} className="text-muted" />
            </div>
            <p className="empty-title">{t('noTransactions')}</p>
            <p className="empty-subtitle">No records match the selected filter criteria.</p>
          </div>
        ) : (
          <div className="sleek-table-container">
            <table className="compact-table">
              <thead>
                <tr>
                  <th>{t('date')}</th>
                  <th>{t('type')}</th>
                  <th>{t('descriptionCategory')}</th>
                  <th>{t('paymentMethodLabel')}</th>
                  <th>{t('source')}</th>
                  <th style={{ textAlign: 'right' }}>{t('amount')}</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id || Math.random()}>
                    <td className="cell-date-dim">{formatDate(tx.createdAt)}</td>

                    <td>
                      <span className={`micro-type-chip ${tx.type === 'Sale' ? 'type-sale' : 'type-expense'}`}>
                        {tx.type === 'Sale' ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                        <span>{tx.type === 'Sale' ? t('sales') : t('expenses')}</span>
                      </span>
                    </td>

                    <td>
                      <strong className="tx-desc-title">{tx.detail}</strong>
                    </td>

                    <td>
                      <span className={`cell-payment-tag ${tx.paymentMethod === 'UPI' ? 'pm-upi-tag' : ''}`}>
                        {tx.paymentMethod === 'UPI' && tx.upiApp ? tx.upiApp : tx.paymentMethod}
                        {tx.utrNumber ? (
                          <span className="cell-utr-sub">UTR •••{tx.utrNumber.slice(-4)}</span>
                        ) : null}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`micro-source-pill ${
                          tx.entryMethod === 'automatic'
                            ? 'src-auto'
                            : tx.entryMethod === 'scanned'
                            ? 'src-scanned'
                            : 'src-manual'
                        }`}
                      >
                        {tx.entryMethod === 'automatic'
                          ? t('automatic')
                          : tx.entryMethod === 'scanned'
                          ? t('scanned')
                          : t('manual')}
                      </span>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <span className={`tx-amount-compact ${tx.type === 'Sale' ? 'text-profit' : 'text-loss'}`}>
                        {tx.type === 'Sale' ? '+' : '-'} ₹{tx.amount.toLocaleString('en-IN')}
                      </span>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn-trash-compact"
                        onClick={() => handleDelete(tx)}
                        title={t('delete')}
                      >
                        <Trash2 size={14} />
                      </button>
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

export default Transactions;
