import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { createSale, getPaymentStatus, getAutomaticPayments } from '../services/api';
import {
  CheckCircle,
  AlertCircle,
  Save,
  ShieldCheck,
  Cpu,
  Wallet,
  CreditCard,
  PlusCircle,
  Sparkles,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

const AddSale = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Connection & Automatic payments state
  const [connectionStatus, setConnectionStatus] = useState({
    upiConnected: false,
    cardConnected: false,
    providerName: 'Not Connected',
  });
  const [autoPayments, setAutoPayments] = useState([]);

  useEffect(() => {
    fetchPaymentData();
  }, []);

  const fetchPaymentData = async () => {
    try {
      const [statusData, autoTxData] = await Promise.all([
        getPaymentStatus(),
        getAutomaticPayments(),
      ]);
      setConnectionStatus(statusData);
      setAutoPayments(autoTxData);
    } catch (err) {
      console.error('Error loading payment provider info:', err);
    }
  };

  const handleQuickAdd = (preset) => {
    const current = Number(amount) || 0;
    setAmount((current + preset).toString());
  };

  const handleSaveCashSale = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!amount || Number(amount) <= 0) {
      setError(t('enterAmountError'));
      return;
    }

    try {
      setLoading(true);
      await createSale({
        amount: Number(amount),
        paymentMethod: 'Cash',
        description: description.trim() || 'Retail Cash Sale',
        entryMethod: 'manual',
      });

      setSuccess(t('saleAddedSuccess'));
      setAmount('');
      setDescription('');

      setTimeout(() => {
        navigate('/transactions');
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="section-page-container">
      {/* Page Title & Breadcrumb */}
      <div className="page-intro-bar">
        <div>
          <h2 className="section-title">Sales Management</h2>
          <p className="section-subtitle">Record cash transactions & monitor incoming digital streams</p>
        </div>
      </div>

      <div className="split-grid-layout">
        {/* LEFT COLUMN: COMPACT CASH SALE FORM */}
        <div className="sleek-panel main-form-panel">
          <div className="panel-header-compact">
            <div className="flex-align-gap">
              <span className="icon-badge-round badge-profit">
                <TrendingUp size={16} />
              </span>
              <div>
                <h3 className="panel-heading">Record Cash Sale</h3>
                <span className="panel-subheading">Instant counter sale voucher</span>
              </div>
            </div>
            <span className="pill-active-mode">Direct Entry</span>
          </div>

          {error && (
            <div className="alert-compact alert-error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="alert-compact alert-success">
              <CheckCircle size={16} />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSaveCashSale} className="compact-form">
            {/* Amount input */}
            <div className="form-group-compact">
              <label className="field-label-compact">{t('saleAmountQuestion')}</label>
              <div className="luxury-amount-box">
                <span className="amount-currency-symbol">₹</span>
                <input
                  type="number"
                  min="1"
                  step="any"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="luxury-amount-input"
                  autoFocus
                />
              </div>

              {/* Quick Add Preset Chips */}
              <div className="quick-presets-strip">
                <span className="presets-label">Quick Add:</span>
                {[100, 200, 500, 1000, 2000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className="preset-chip"
                    onClick={() => handleQuickAdd(preset)}
                  >
                    +₹{preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Description field */}
            <div className="form-group-compact">
              <label className="field-label-compact">{t('optionalDescription')}</label>
              <input
                type="text"
                placeholder="e.g. Retail item purchase, groceries, bill #104"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="sleek-text-input"
              />
            </div>

            {/* Submit button */}
            <button type="submit" className="sleek-btn-primary btn-emerald" disabled={loading}>
              <Save size={16} />
              <span>{loading ? 'Recording...' : 'Record Cash Sale'}</span>
            </button>
          </form>
        </div>

        {/* RIGHT COLUMN: CHANNELS & AUTOMATIC PAYMENTS */}
        <div className="side-column-panels">
          {/* Connected Gateway Status */}
          <div className="sleek-panel side-channel-panel">
            <div className="panel-header-compact">
              <div className="flex-align-gap">
                <ShieldCheck size={16} className="text-cyan" />
                <h3 className="panel-heading">{t('connectedPayments')}</h3>
              </div>
              <button
                type="button"
                className="link-settings-mini"
                onClick={() => navigate('/settings')}
              >
                Configure
              </button>
            </div>

            <p className="micro-notice">{t('manualOnlyNotice')}</p>

            <div className="gateway-status-list">
              {/* UPI Channel */}
              <div className="gateway-row-compact">
                <div className="flex-align-gap">
                  <div className="gateway-icon-box bg-purple-soft">
                    <Wallet size={15} className="text-purple" />
                  </div>
                  <div>
                    <strong className="gw-title">{t('upiStatus')}</strong>
                    <span className="gw-desc">QR & Virtual Payment Address</span>
                  </div>
                </div>
                <span className={`status-micro-pill ${connectionStatus.upiConnected ? 'pill-profit' : 'pill-standby'}`}>
                  {connectionStatus.upiConnected ? '● Active' : '○ Standby'}
                </span>
              </div>

              {/* Card Channel */}
              <div className="gateway-row-compact">
                <div className="flex-align-gap">
                  <div className="gateway-icon-box bg-blue-soft">
                    <CreditCard size={15} className="text-blue" />
                  </div>
                  <div>
                    <strong className="gw-title">{t('cardStatus')}</strong>
                    <span className="gw-desc">POS Terminal & Online Gateways</span>
                  </div>
                </div>
                <span className={`status-micro-pill ${connectionStatus.cardConnected ? 'pill-profit' : 'pill-standby'}`}>
                  {connectionStatus.cardConnected ? '● Active' : '○ Standby'}
                </span>
              </div>
            </div>
          </div>

          {/* Automatic Incoming Feed */}
          <div className="sleek-panel auto-feed-panel">
            <div className="panel-header-compact">
              <div className="flex-align-gap">
                <Cpu size={16} className="text-cyan" />
                <h3 className="panel-heading">{t('automaticPayments')}</h3>
              </div>
              <span className="badge-count">{autoPayments.length} synced</span>
            </div>

            {autoPayments.length === 0 ? (
              <div className="empty-sub-state">
                <p>{t('noAutomaticPayments')}</p>
                <span className="micro-hint">Connected webhook deposits appear automatically here.</span>
              </div>
            ) : (
              <div className="micro-tx-list">
                {autoPayments.slice(0, 4).map((tx) => (
                  <div key={tx._id} className="micro-tx-row">
                    <div className="micro-tx-left">
                      <span className="micro-date">{formatTime(tx.createdAt)}</span>
                      <strong className="micro-code">
                        TXN•••{tx.providerTransactionId ? tx.providerTransactionId.slice(-6) : 'AUTO'}
                      </strong>
                      <span className="micro-tag-method">{tx.paymentMethod}</span>
                    </div>
                    <div className="micro-tx-right">
                      <strong className="text-profit">+₹{tx.amount?.toLocaleString('en-IN')}</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddSale;
