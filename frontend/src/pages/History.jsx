import React, { useEffect, useState, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import {
  getSales,
  getExpenses,
  deleteSale,
  deleteExpense,
  getSetuTransactions,
} from '../services/api';
import useRealtimeEvents from '../hooks/useRealtimeEvents';
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
  Building2,
  Landmark,
} from 'lucide-react';

const Transactions = () => {
  const { t } = useLanguage();

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');



  // Filters
  const [typeFilter, setTypeFilter] = useState('All'); // 'All', 'Sales', 'Expenses', 'Bank Feed'
  const [entryFilter, setEntryFilter] = useState('All'); // 'All', 'Manual', 'Automatic', 'Scanned', 'Setu AA'
  const [timeFilter, setTimeFilter] = useState('All Time'); // 'Today', 'This Week', 'This Month', 'This Year', 'All Time'

  const fetchData = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true);
      const [salesData, expensesData, setuData] = await Promise.all([
        getSales(),
        getExpenses(),
        getSetuTransactions().catch(() => ({ transactions: [] })),
      ]);

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
        isTest: Boolean(s.isTest),
        createdAt: s.createdAt,
      }));

      const formattedExpenses = expensesData.map((e) => ({
        id: e._id,
        rawId: e._id,
        type: 'Expense',
        detail: e.description || e.category,
        paidTo: e.paidTo,
        category: e.category,
        paymentMethod: e.paymentMethod || 'Cash',
        upiApp: e.upiApp || e.provider,
        utrNumber: e.utrNumber,
        entryMethod: e.entryMethod || 'manual',
        paymentStatus: e.paymentStatus || 'recorded',
        amount: e.amount,
        isTest: Boolean(e.isTest),
        createdAt: e.createdAt,
      }));

      const formattedBank = (setuData?.transactions || []).map((b) => ({
        id: b._id,
        rawId: b._id,
        type: b.type === 'CREDIT' ? 'Bank Credit' : 'Bank Debit',
        detail: b.narration || (b.type === 'CREDIT' ? 'Setu AA Deposit' : 'Setu AA Withdrawal'),
        category: 'Bank Feed',
        paymentMethod: b.mode || 'Bank Transfer',
        upiApp: b.mode || 'Setu AA',
        utrNumber: b.reference,
        entryMethod: 'setu_aa',
        paymentStatus: 'success',
        amount: b.amount,
        isTest: Boolean(b.isTest),
        source: b.source,
        accountMasked: b.accountMasked,
        classification: b.classification,
        alreadyExistsInApp: b.alreadyExistsInApp,
        createdAt: b.transactionTimestamp || b.createdAt,
      }));

      const combined = [...formattedSales, ...formattedExpenses, ...formattedBank].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );

      setTransactions(combined);
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  // Real-Time Event Subscription (No polling!)
  const { isConnected } = useRealtimeEvents({
    onPaymentSuccess: () => fetchData(false),
    onSaleCreated: () => fetchData(false),
    onExpenseCreated: () => fetchData(false),
    onTransactionCreated: () => fetchData(false),
    onReconnect: () => fetchData(false),
    onAnyEvent: (type) => {
      if (type === 'setu.data_imported') {
        fetchData(false);
      }
    },
  });

  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  const handleDelete = async (tx) => {
    if (tx.entryMethod === 'setu_aa') {
      alert('Bank statement feed records cannot be deleted; they maintain financial audit compliance.');
      return;
    }

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
    if (typeFilter === 'Bank Feed' && !tx.type.includes('Bank')) return false;

    if (entryFilter === 'Manual' && tx.entryMethod !== 'manual') return false;
    if (entryFilter === 'Automatic' && tx.entryMethod !== 'automatic') return false;
    if (entryFilter === 'Scanned' && tx.entryMethod !== 'scanned') return false;
    if (entryFilter === 'Setu AA' && tx.entryMethod !== 'setu_aa') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchDetail = tx.detail?.toLowerCase().includes(q);
      const matchPayee = tx.paidTo?.toLowerCase().includes(q);
      const matchMethod = tx.paymentMethod?.toLowerCase().includes(q);
      const matchApp = tx.upiApp?.toLowerCase().includes(q);
      const matchAmount = tx.amount?.toString().includes(q);
      if (!matchDetail && !matchPayee && !matchMethod && !matchApp && !matchAmount) return false;
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
    <div className="section-page-container transactions-page-container">
      {/* Page Title & Breadcrumb */}
      <div className="page-intro-bar">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 className="section-title">{t('navTransactions')}</h2>
            <span
              style={{
                fontSize: '11px',
                fontWeight: '600',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '2px 8px',
                borderRadius: '999px',
                backgroundColor: isConnected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                color: isConnected ? '#059669' : '#64748b',
                border: `1px solid ${isConnected ? 'rgba(16, 185, 129, 0.25)' : 'rgba(100, 116, 139, 0.25)'}`,
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: isConnected ? '#10b981' : '#94a3b8',
                }}
              />
              {isConnected ? 'Live Sync' : 'Reconnecting...'}
            </span>
          </div>
          <p className="section-subtitle">Real-time ledger of retail receipts, operational invoices, and webhooks</p>
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
                {['All', 'Sales', 'Expenses', 'Bank Feed'].map((type) => (
                  <button
                    key={type}
                    className={`mini-segment-btn ${typeFilter === type ? 'active' : ''}`}
                    onClick={() => setTypeFilter(type)}
                  >
                    {type === 'Bank Feed' ? '🏦 Bank Feed' : (t(type.toLowerCase()) || type)}
                  </button>
                ))}
              </div>
            </div>

            {/* Source */}
            <div className="mini-filter-group">
              <span className="filter-tag-title">Source:</span>
              <div className="mini-segmented-control">
                {['All', 'Manual', 'Automatic', 'Scanned', 'Setu AA'].map((source) => (
                  <button
                    key={source}
                    className={`mini-segment-btn ${entryFilter === source ? 'active' : ''}`}
                    onClick={() => setEntryFilter(source)}
                  >
                    {source === 'Setu AA' ? '⚡ Setu AA' : (t(source.toLowerCase()) || source)}
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
          <div className="sleek-table-container ledger-scroll-container">
            <table className="compact-table">
              <thead>
                <tr>
                  <th>Date &amp; Time</th>
                  <th>Type</th>
                  <th>Description / Category</th>
                  <th>Payment Method</th>
                  <th>Source</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id || Math.random()}>
                    <td className="cell-date-dim">{formatDate(tx.createdAt)}</td>

                    <td>
                      {tx.entryMethod === 'setu_aa' ? (
                        <span
                          className="micro-type-chip"
                          style={{
                            backgroundColor: tx.type === 'Bank Credit' ? 'rgba(2, 132, 199, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                            color: tx.type === 'Bank Credit' ? '#38bdf8' : '#fbbf24',
                            border: `1px solid ${tx.type === 'Bank Credit' ? 'rgba(56, 189, 248, 0.4)' : 'rgba(251, 191, 36, 0.4)'}`,
                          }}
                        >
                          <Building2 size={11} />
                          <span>{tx.type}</span>
                        </span>
                      ) : (
                        <span className={`micro-type-chip ${tx.type === 'Sale' ? 'type-sale' : 'type-expense'}`}>
                          {tx.type === 'Sale' ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                          <span>{tx.type === 'Sale' ? (t('sales') || 'Sale') : (t('expenses') || 'Expense')}</span>
                        </span>
                      )}
                    </td>

                    <td>
                      <strong className="tx-desc-title">{tx.detail}</strong>
                      {tx.accountMasked ? (
                        <span className="tx-payee-sub" style={{ color: '#38bdf8', display: 'block', fontSize: '11px', marginTop: '2px' }}>
                          🏦 Bank Acc: {tx.accountMasked}
                        </span>
                      ) : tx.paidTo ? (
                        <span className="tx-payee-sub" style={{ color: '#38bdf8', display: 'block', fontSize: '11px', marginTop: '2px' }}>
                          👤 To: {tx.paidTo}
                        </span>
                      ) : null}
                      {tx.alreadyExistsInApp && (
                        <span style={{ fontSize: '11px', color: '#34d399', display: 'block', fontWeight: '600', marginTop: '2px' }}>
                          ✓ Reconciled with existing shop record
                        </span>
                      )}
                    </td>

                    <td>
                      <span className={`cell-payment-tag ${tx.paymentMethod === 'UPI' || tx.upiApp ? 'pm-upi-tag' : ''}`}>
                        {tx.upiApp ? tx.upiApp : (tx.paymentMethod || 'Cash')}
                      </span>
                    </td>

                    <td>
                      {tx.entryMethod === 'setu_aa' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <span
                            className="micro-source-pill"
                            style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.35)' }}
                          >
                            🏦 Setu AA
                          </span>
                          {tx.isTest && (
                            <span style={{ fontSize: '9px', fontWeight: '800', padding: '1px 4px', borderRadius: '4px', backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
                              SANDBOX
                            </span>
                          )}
                        </span>
                      ) : (
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
                            ? (t('automatic') || 'AUTOMATIC')
                            : tx.entryMethod === 'scanned'
                            ? (t('scanned') || 'SCANNED')
                            : (t('manual') || 'MANUAL')}
                        </span>
                      )}
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <span className={`tx-amount-compact ${tx.type === 'Sale' || tx.type === 'Bank Credit' ? 'text-profit' : 'text-loss'}`} style={{ fontSize: '14px', fontWeight: '800' }}>
                        {tx.type === 'Sale' || tx.type === 'Bank Credit' ? '+' : '-'} ₹{Number(tx.amount || 0).toLocaleString('en-IN')}
                      </span>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn-trash-compact"
                        onClick={() => handleDelete(tx)}
                        title={t('delete') || 'Delete'}
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
