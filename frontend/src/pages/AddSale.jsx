import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import {
  createSale,
  getPaymentStatus,
  getAutomaticPayments,
  simulateTestPayment,
} from '../services/api';
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
  QrCode,
  Smartphone,
  Banknote,
  Zap,
} from 'lucide-react';

const AddSale = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI'); // Default to UPI / GPay as requested
  const [upiApp, setUpiApp] = useState('Google Pay');
  const [utrNumber, setUtrNumber] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [simulating, setSimulating] = useState(false);

  // Connection & Automatic payments state
  const [connectionStatus, setConnectionStatus] = useState({
    upiConnected: false,
    cardConnected: false,
    providerName: 'Google Pay',
    merchantVpa: '',
    upiProvider: 'Google Pay',
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

  const handleSaveSale = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!amount || Number(amount) <= 0) {
      setError(t('enterAmountError'));
      return;
    }

    try {
      setLoading(true);
      const salePayload = {
        amount: Number(amount),
        paymentMethod,
        description:
          description.trim() ||
          (paymentMethod === 'UPI'
            ? `${upiApp} Customer Payment`
            : paymentMethod === 'Card'
            ? 'Card POS Sale'
            : 'Retail Cash Sale'),
        entryMethod: 'manual',
        upiApp: paymentMethod === 'UPI' ? upiApp : '',
        utrNumber: utrNumber ? utrNumber.trim() : '',
      };

      await createSale(salePayload);

      setSuccess(
        paymentMethod === 'UPI'
          ? `₹${amount} ${upiApp} payment recorded successfully!`
          : t('saleAddedSuccess')
      );
      setAmount('');
      setDescription('');
      setUtrNumber('');

      await fetchPaymentData();

      setTimeout(() => {
        navigate('/transactions');
      }, 1200);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Quick simulation helper
  const handleQuickSimulateGPay = async () => {
    const simAmount = Number(amount) > 0 ? Number(amount) : 500;
    setError('');
    setSuccess('');
    try {
      setSimulating(true);
      const res = await simulateTestPayment({
        amount: simAmount,
        provider: upiApp,
        direction: 'received',
        upiApp: upiApp,
        note: `Customer scanned GPay QR and paid ₹${simAmount}`,
      });
      setSuccess(res.message || `₹${simAmount} received via ${upiApp}! Sale registered.`);
      await fetchPaymentData();
      setAmount('');
      setUtrNumber('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to simulate payment');
    } finally {
      setSimulating(false);
    }
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  // Dynamic QR Code generation for UPI/GPay
  const activeVpa = connectionStatus.merchantVpa || 'merchant@okaxis';
  const qrUpiUrl = `upi://pay?pa=${encodeURIComponent(activeVpa)}&pn=${encodeURIComponent(
    'Smart Shop'
  )}&am=${encodeURIComponent(amount || '')}&cu=INR`;
  const qrImgSrc = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
    qrUpiUrl
  )}&margin=10`;

  return (
    <div className="section-page-container">
      {/* Page Title & Breadcrumb */}
      <div className="page-intro-bar">
        <div>
          <h2 className="section-title">Sales Management</h2>
          <p className="section-subtitle">
            Accept Google Pay, UPI QR codes, Cash & Card payments with instant ledger updates
          </p>
        </div>
      </div>

      <div className="split-grid-layout">
        {/* LEFT COLUMN: SALE ENTRY FORM */}
        <div className="sleek-panel main-form-panel">
          <div className="panel-header-compact">
            <div className="flex-align-gap">
              <span className="icon-badge-round badge-profit">
                <TrendingUp size={16} />
              </span>
              <div>
                <h3 className="panel-heading">Record Customer Sale</h3>
                <span className="panel-subheading">Cash or Google Pay / UPI counter payment</span>
              </div>
            </div>
            <span className="pill-active-mode">
              {paymentMethod === 'UPI' ? '● GPay / UPI Ready' : 'Direct Entry'}
            </span>
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

          <form onSubmit={handleSaveSale} className="compact-form">
            {/* Payment Method Selector Tabs */}
            <div className="form-group-compact">
              <label className="field-label-compact">{t('paymentMethodLabel') || 'Payment Method'}</label>
              <div className="payment-method-selector-compact">
                <button
                  type="button"
                  className={`pm-pill-btn ${paymentMethod === 'UPI' ? 'pm-pill-active' : ''}`}
                  onClick={() => setPaymentMethod('UPI')}
                >
                  <Smartphone size={14} />
                  <span>Google Pay / UPI</span>
                </button>
                <button
                  type="button"
                  className={`pm-pill-btn ${paymentMethod === 'Cash' ? 'pm-pill-active' : ''}`}
                  onClick={() => setPaymentMethod('Cash')}
                >
                  <Banknote size={14} />
                  <span>Cash</span>
                </button>
                <button
                  type="button"
                  className={`pm-pill-btn ${paymentMethod === 'Card' ? 'pm-pill-active' : ''}`}
                  onClick={() => setPaymentMethod('Card')}
                >
                  <CreditCard size={14} />
                  <span>Card POS</span>
                </button>
              </div>
            </div>

            {/* If UPI is selected: Choose UPI Provider App */}
            {paymentMethod === 'UPI' && (
              <div className="form-group-compact">
                <label className="field-label-compact">Customer Payment App</label>
                <div className="upi-app-strip">
                  {['Google Pay', 'PhonePe', 'Paytm', 'BHIM / Other'].map((app) => (
                    <button
                      key={app}
                      type="button"
                      className={`upi-app-chip ${upiApp === app ? 'active-app' : ''}`}
                      onClick={() => setUpiApp(app)}
                    >
                      {app === 'Google Pay' && <span className="gpay-dot">●</span>}
                      {app}
                    </button>
                  ))}
                </div>
              </div>
            )}

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
                {[50, 100, 200, 500, 1000].map((preset) => (
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

            {/* Dynamic Google Pay / UPI QR Code Card */}
            {paymentMethod === 'UPI' && (
              <div className="store-qr-card-compact">
                <div className="qr-card-left">
                  <img
                    src={qrImgSrc}
                    alt="Scan UPI / GPay QR"
                    className="store-qr-img"
                    loading="lazy"
                  />
                </div>
                <div className="qr-card-right">
                  <div className="badge-gpay-pill">
                    <span className="gpay-g">G</span>Pay & UPI QR
                  </div>
                  <strong className="qr-amount-notice">
                    {amount && Number(amount) > 0
                      ? `Scan to pay ₹${Number(amount).toLocaleString('en-IN')}`
                      : 'Scan to pay any amount'}
                  </strong>
                  <p className="qr-vpa-text">VPA: <code>{activeVpa}</code></p>
                  <span className="qr-helper-tip">
                    Customer opens Google Pay or any UPI app, scans code & confirms.
                  </span>

                  <button
                    type="button"
                    className="btn-sim-test-inline"
                    onClick={handleQuickSimulateGPay}
                    disabled={simulating}
                  >
                    <Zap size={13} />
                    <span>{simulating ? 'Simulating...' : `Simulate ${upiApp} Payment (Instant)`}</span>
                  </button>
                </div>
              </div>
            )}

            {/* UTR Reference input for UPI */}
            {paymentMethod === 'UPI' && (
              <div className="form-group-compact">
                <label className="field-label-compact">
                  12-Digit UTR / Transaction Reference (Optional)
                </label>
                <input
                  type="text"
                  maxLength={20}
                  placeholder="e.g. 451493008588"
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value)}
                  className="sleek-text-input"
                />
              </div>
            )}

            {/* Description field */}
            <div className="form-group-compact">
              <label className="field-label-compact">{t('optionalDescription')}</label>
              <input
                type="text"
                placeholder={
                  paymentMethod === 'UPI'
                    ? 'e.g. Counter sale, bill #204, grocery customer'
                    : 'e.g. Retail item purchase, groceries, bill #104'
                }
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="sleek-text-input"
              />
            </div>

            {/* Submit button */}
            <button
              type="submit"
              className={`sleek-btn-primary ${
                paymentMethod === 'UPI' ? 'btn-gpay-primary' : 'btn-emerald'
              }`}
              disabled={loading}
            >
              <Save size={16} />
              <span>
                {loading
                  ? 'Recording...'
                  : paymentMethod === 'UPI'
                  ? `Record ${upiApp} Sale`
                  : paymentMethod === 'Card'
                  ? 'Record Card Sale'
                  : 'Record Cash Sale'}
              </span>
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

            <p className="micro-notice">
              Payments received via Google Pay, UPI QR, or webhook verify and credit automatically.
            </p>

            <div className="gateway-status-list">
              {/* UPI & Google Pay Channel */}
              <div className="gateway-row-compact">
                <div className="flex-align-gap">
                  <div className="gateway-icon-box bg-purple-soft">
                    <Smartphone size={15} className="text-purple" />
                  </div>
                  <div>
                    <strong className="gw-title">Google Pay / UPI</strong>
                    <span className="gw-desc">
                      {connectionStatus.merchantVpa || 'Active & Ready for Inflow'}
                    </span>
                  </div>
                </div>
                <span className="status-micro-pill pill-profit">
                  ● Active
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
                    <span className="gw-desc">POS Terminal & Gateways</span>
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
                <span className="micro-hint">Connected Google Pay & UPI deposits appear automatically here.</span>
              </div>
            ) : (
              <div className="micro-tx-list">
                {autoPayments.slice(0, 5).map((tx) => (
                  <div key={tx._id} className="micro-tx-row">
                    <div className="micro-tx-left">
                      <span className="micro-date">{formatTime(tx.createdAt)}</span>
                      <strong className="micro-code">
                        {tx.upiApp || tx.provider || 'UPI'} •••
                        {tx.utrNumber
                          ? tx.utrNumber.slice(-4)
                          : tx.providerTransactionId
                          ? tx.providerTransactionId.slice(-4)
                          : 'OK'}
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
