import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { getPaymentStatus, saveMerchantConfig, simulateTestPayment } from '../services/api';
import {
  Settings as SettingsIcon,
  Globe,
  DollarSign,
  Store,
  CheckCircle,
  ShieldCheck,
  Wallet,
  CreditCard,
  Zap,
  Lock,
  QrCode,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';

const Settings = () => {
  const { language, setLanguage, t } = useLanguage();
  const [shopName, setShopName] = useState('Smart Business Shop');
  const [saved, setSaved] = useState(false);
  const [testSuccess, setTestSuccess] = useState('');

  // Payment Setup Form State
  const [upiProvider, setUpiProvider] = useState('Google Pay');
  const [merchantVpa, setMerchantVpa] = useState('');
  const [cardProvider, setCardProvider] = useState('Razorpay');

  const [paymentStatus, setPaymentStatus] = useState({
    upiConnected: false,
    cardConnected: false,
    providerName: 'Google Pay',
    merchantVpa: '',
  });

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const status = await getPaymentStatus();
      setPaymentStatus(status);
      if (status.merchantVpa) setMerchantVpa(status.merchantVpa);
      if (status.upiProvider) setUpiProvider(status.upiProvider);
    } catch (err) {
      console.error('Error loading payment connection status:', err);
    }
  };

  const handleSaveSettings = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleConnectUpi = async (e) => {
    e.preventDefault();
    try {
      const res = await saveMerchantConfig({
        provider: upiProvider,
        merchantVpa: merchantVpa.trim(),
      });
      setPaymentStatus((prev) => ({
        ...prev,
        upiConnected: res.upiConnected,
        merchantVpa: merchantVpa.trim(),
        providerName: upiProvider,
      }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert('Failed to connect UPI merchant configuration.');
    }
  };

  const handleConnectCard = async (e) => {
    e.preventDefault();
    try {
      const res = await saveMerchantConfig({
        cardProvider,
      });
      setPaymentStatus((prev) => ({
        ...prev,
        cardConnected: res.cardConnected,
      }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert('Failed to connect Card payment provider.');
    }
  };

  const handleRunSimulatedPayment = async (direction, amount, upiApp = 'Google Pay', category = 'Stock') => {
    try {
      const res = await simulateTestPayment({
        direction,
        amount,
        paymentMethod: 'UPI',
        upiApp,
        category,
      });
      setTestSuccess(res.message);
      setTimeout(() => setTestSuccess(''), 4500);
    } catch (err) {
      alert('Failed to execute simulated payment.');
    }
  };

  // Google Pay QR Link
  const displayVpa = merchantVpa || paymentStatus.merchantVpa || 'shop@okhdfcbank';
  const upiIntentString = `upi://pay?pa=${encodeURIComponent(displayVpa)}&pn=${encodeURIComponent(shopName)}&cu=INR`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(upiIntentString)}`;

  return (
    <div className="section-page-container">
      {/* Page Title & Breadcrumb */}
      <div className="page-intro-bar">
        <div>
          <h2 className="section-title">{t('navSettings')}</h2>
          <p className="section-subtitle">Store identity, localization preferences, and Google Pay & UPI integrations</p>
        </div>
      </div>

      <div className="split-grid-layout">
        {/* LEFT COLUMN: SHOP & PREFERENCES */}
        <div className="sleek-panel main-form-panel">
          <div className="panel-header-compact">
            <div className="flex-align-gap">
              <span className="icon-badge-round badge-cyan">
                <Store size={16} />
              </span>
              <div>
                <h3 className="panel-heading">Store Profile & Region</h3>
                <span className="panel-subheading">Public naming and display locale</span>
              </div>
            </div>
          </div>

          {saved && (
            <div className="alert-compact alert-success">
              <CheckCircle size={16} />
              <span>Settings updated successfully!</span>
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="compact-form">
            <div className="form-group-compact">
              <label className="field-label-compact">Shop / Business Name</label>
              <input
                type="text"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                className="sleek-text-input"
              />
            </div>

            <div className="form-group-compact">
              <label className="field-label-compact">Interface Language</label>
              <div className="mini-segmented-control w-full">
                <button
                  type="button"
                  className={`mini-segment-btn ${language === 'en' ? 'active' : ''}`}
                  onClick={() => setLanguage('en')}
                >
                  <Globe size={13} /> English
                </button>
                <button
                  type="button"
                  className={`mini-segment-btn ${language === 'ta' ? 'active' : ''}`}
                  onClick={() => setLanguage('ta')}
                >
                  <Globe size={13} /> தமிழ் (Tamil)
                </button>
              </div>
            </div>

            <div className="form-group-compact">
              <label className="field-label-compact">Operating Currency</label>
              <div className="static-currency-badge">
                <DollarSign size={14} className="text-cyan" />
                <span>₹ Indian Rupee (INR) — Official Standard</span>
              </div>
            </div>

            <button type="submit" className="sleek-btn-primary btn-cyan">
              Save Profile Changes
            </button>
          </form>

          {/* Live Store QR Preview */}
          <div className="store-qr-preview-box mt-16">
            <div className="flex-align-gap mb-8">
              <QrCode size={16} className="text-cyan" />
              <strong style={{ fontSize: '13px' }}>Store Google Pay / UPI QR Code</strong>
            </div>
            <p className="micro-notice">
              Customers scan this QR code with <strong>Google Pay (GPay)</strong>, PhonePe, or Paytm to pay directly to your VPA: <code>{displayVpa}</code>
            </p>
            <div className="qr-preview-flex">
              <img src={qrCodeUrl} alt="Store UPI QR Code" className="store-qr-img" />
              <div className="qr-info-right">
                <span className="badge-gpay-pill">Google Pay Ready</span>
                <span className="vpa-text-display">{displayVpa}</span>
                <span className="merchant-name-display">{shopName}</span>
                <a
                  href={upiIntentString}
                  className="link-gpay-intent"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open UPI Link
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: PAYMENT GATEWAYS & DEV SIMULATOR */}
        <div className="side-column-panels">
          {/* UPI Gateway */}
          <div className="sleek-panel gateway-panel-sleek">
            <div className="panel-header-compact">
              <div className="flex-align-gap">
                <Wallet size={15} className="text-purple" />
                <h3 className="panel-heading">1. Google Pay & UPI Connection</h3>
              </div>
              <span className={`status-micro-pill ${paymentStatus.upiConnected ? 'pill-profit' : 'pill-standby'}`}>
                {paymentStatus.upiConnected ? '● Active' : '○ Standby'}
              </span>
            </div>

            <form onSubmit={handleConnectUpi} className="compact-form">
              <div className="form-group-compact">
                <label className="field-label-compact">Primary UPI Provider</label>
                <select
                  value={upiProvider}
                  onChange={(e) => setUpiProvider(e.target.value)}
                  className="sleek-select-input"
                >
                  <option value="Google Pay">Google Pay (GPay) — UPI Direct & Business</option>
                  <option value="PhonePe">PhonePe Business</option>
                  <option value="Paytm">Paytm for Business</option>
                  <option value="BHIM UPI">BHIM UPI / Bank UPI</option>
                  <option value="Razorpay">Razorpay Merchant Gateway</option>
                  <option value="Cashfree">Cashfree Payments</option>
                </select>
              </div>

              <div className="form-group-compact">
                <label className="field-label-compact">Merchant UPI ID / VPA (GPay / Bank Handle)</label>
                <input
                  type="text"
                  placeholder="e.g. yourname@okhdfcbank, store@okaxis, or 9876543210@paytm"
                  value={merchantVpa}
                  onChange={(e) => setMerchantVpa(e.target.value)}
                  className="sleek-text-input"
                />
              </div>

              <button type="submit" className="sleek-btn-primary btn-emerald">
                Save & Connect Google Pay
              </button>
            </form>
          </div>

          {/* Card POS Gateway */}
          <div className="sleek-panel gateway-panel-sleek">
            <div className="panel-header-compact">
              <div className="flex-align-gap">
                <CreditCard size={15} className="text-blue" />
                <h3 className="panel-heading">2. {t('cardStatus')}</h3>
              </div>
              <span className={`status-micro-pill ${paymentStatus.cardConnected ? 'pill-profit' : 'pill-standby'}`}>
                {paymentStatus.cardConnected ? '● Connected' : '○ Standby'}
              </span>
            </div>

            <p className="micro-notice">
              <Lock size={12} style={{ display: 'inline', marginRight: '4px' }} />
              PCI-DSS tokenized gateway. Sensitive card details are never stored locally.
            </p>

            <form onSubmit={handleConnectCard} className="compact-form">
              <div className="form-group-compact">
                <label className="field-label-compact">{t('selectProvider')}</label>
                <select
                  value={cardProvider}
                  onChange={(e) => setCardProvider(e.target.value)}
                  className="sleek-select-input"
                >
                  <option value="Razorpay">Razorpay Card POS Gateway</option>
                  <option value="Cashfree">Cashfree Card Gateway</option>
                  <option value="Stripe">Stripe Terminal / Card</option>
                </select>
              </div>

              <button type="submit" className="sleek-btn-primary btn-blue">
                {t('connectCard')}
              </button>
            </form>
          </div>

          {/* Developer Webhook Simulator (Receive & Send Money) */}
          <div className="sleek-panel test-simulator-panel">
            <div className="panel-header-compact">
              <div className="flex-align-gap">
                <Zap size={15} className="text-amber" />
                <h3 className="panel-heading">GPay & UPI Live Simulator</h3>
              </div>
              <span className="badge-test-mode">Instant Sync</span>
            </div>

            <p className="micro-notice">
              Test instant real-time ledger updates when receiving money (Customer payment) or sending money (Vendor payout) via Google Pay:
            </p>

            {testSuccess && (
              <div className="alert-compact alert-success mb-10">
                <CheckCircle size={14} />
                <span>{testSuccess}</span>
              </div>
            )}

            <div className="simulator-actions-strip">
              <button
                type="button"
                className="sim-chip-btn sim-emerald"
                onClick={() => handleRunSimulatedPayment('received', 500, 'Google Pay')}
              >
                <ArrowDownLeft size={13} /> Receive ₹500 via GPay (Sale)
              </button>
              <button
                type="button"
                className="sim-chip-btn sim-rose"
                onClick={() => handleRunSimulatedPayment('sent', 350, 'Google Pay', 'Stock')}
              >
                <ArrowUpRight size={13} /> Send ₹350 via GPay (Expense)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
