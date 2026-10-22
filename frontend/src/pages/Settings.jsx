import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import {
  getPaymentStatus,
  saveMerchantConfig,
  simulateTestPayment,
  getSetuConfig,
  createSetuConsent,
  fetchAndImportSetuData,
} from '../services/api';
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
  Building2,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Landmark,
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

  // Setu Account Aggregator State
  const [setuConfig, setSetuConfig] = useState(null);
  const [setuPhone, setSetuPhone] = useState('9999999999');
  const [setuLoading, setSetuLoading] = useState(false);
  const [setuResult, setSetuResult] = useState(null);
  const [setuError, setSetuError] = useState('');

  // Stage 3 Bank Data Fetch State
  const [fetchConsentId, setFetchConsentId] = useState('');
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchResult, setFetchResult] = useState(null);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    fetchStatus();
    fetchSetuStatus();
  }, []);

  const fetchSetuStatus = async () => {
    try {
      const res = await getSetuConfig();
      if (res?.config) {
        setSetuConfig(res.config);
      }
    } catch (err) {
      console.warn('Setu config status fetch skipped or failed:', err.message);
    }
  };

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

  const handleInitiateSetuConsent = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setSetuLoading(true);
    setSetuError('');
    setSetuResult(null);

    const token = localStorage.getItem('token');
    if (!token) {
      setSetuLoading(false);
      setSetuError('Session expired. Please log in again to connect your bank account.');
      return;
    }

    try {
      const redirectUrl = `${window.location.origin}/setu-callback`;
      const res = await createSetuConsent({
        customerPhone: setuPhone.trim() || '9999999999',
        redirectUrl,
      });

      if (res.success && res.consentUrl) {
        setSetuResult(res);
        // Open Setu Consent URL in a new tab for sandbox user approval
        window.open(res.consentUrl, '_blank', 'noopener,noreferrer');
      } else {
        setSetuError(res.message || 'Unable to create Setu consent session.');
      }
    } catch (err) {
      console.error('Failed to initiate Setu AA consent:', err);
      let errMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Error connecting to Setu Account Aggregator API.';

      if (
        err.response?.status === 401 &&
        (errMsg.toLowerCase().includes('token') ||
          errMsg.toLowerCase().includes('not authorized') ||
          errMsg.toLowerCase().includes('unauthorized'))
      ) {
        errMsg = 'Your login session has expired or you are not logged in. Please log in to connect your bank account.';
      }
      setSetuError(errMsg);
    } finally {
      setSetuLoading(false);
    }
  };

  const handleFetchBankTransactions = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const targetConsentId = fetchConsentId.trim() || setuResult?.consentId;
    if (!targetConsentId) {
      setFetchError('Please provide an active Consent ID or connect via Setu AA above.');
      return;
    }

    setFetchLoading(true);
    setFetchError('');
    setFetchResult(null);

    try {
      const res = await fetchAndImportSetuData({ consentId: targetConsentId });
      if (res.success) {
        setFetchResult(res);
      } else {
        setFetchError(res.message || 'Failed to fetch bank data.');
      }
    } catch (err) {
      console.error('Fetch bank data error:', err);
      setFetchError(
        err.response?.data?.message || err.message || 'Error communicating with Setu Data API.'
      );
    } finally {
      setFetchLoading(false);
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
              <strong style={{ fontSize: '13px', color: '#ffffff' }}>Store Google Pay / UPI QR Code</strong>
            </div>
            <p className="micro-notice">
              Customers scan this QR code with <strong>Google Pay (GPay)</strong>, PhonePe, or Paytm to pay directly to your VPA: <code>{displayVpa}</code>
            </p>
            <div className="qr-preview-flex">
              <img src={qrCodeUrl} alt="Store UPI QR Code" className="store-qr-img" />
              <div className="qr-info-right">
                <span className="badge-gpay-pill">
                  <QrCode size={12} className="text-cyan" /> UPI QR Ready
                </span>
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
          {/* Payment Gateway Status Panel */}
          <div className="sleek-panel gateway-panel-sleek">
            <div className="panel-header-compact">
              <div className="flex-align-gap">
                <ShieldCheck size={16} className="text-emerald" />
                <h3 className="panel-heading">Payment Gateway Architecture</h3>
              </div>
              <span
                className={`status-micro-pill ${
                  paymentStatus.gatewayStatus === 'Connected'
                    ? 'pill-profit'
                    : paymentStatus.gatewayStatus === 'Sandbox'
                    ? 'pill-amber'
                    : 'pill-standby'
                }`}
              >
                {paymentStatus.gatewayStatus === 'Connected'
                  ? '● Connected'
                  : paymentStatus.gatewayStatus === 'Sandbox'
                  ? '⚡ Sandbox Active'
                  : '○ Not Connected'}
              </span>
            </div>

            <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.6', marginBottom: '12px' }}>
              <div><strong style={{ color: '#ffffff' }}>Gateway Provider:</strong> {paymentStatus.providerName || 'Razorpay / Cashfree'}</div>
              <div>
                <strong style={{ color: '#ffffff' }}>Environment:</strong>{' '}
                <span style={{ fontWeight: '700', color: paymentStatus.environment === 'production' ? '#34d399' : '#fbbf24' }}>
                  {paymentStatus.environment === 'production' ? 'Production (Live)' : 'Sandbox / Test Mode'}
                </span>
              </div>
              <div>
                <strong style={{ color: '#ffffff' }}>Auto Ingestion Status:</strong>{' '}
                <span style={{ fontWeight: '600', color: paymentStatus.autoIngestionAvailable ? '#34d399' : '#f87171' }}>
                  {paymentStatus.autoIngestionAvailable ? 'Active via HMAC Webhook & REST Sync' : 'Not Configured'}
                </span>
              </div>
              <div>
                <strong style={{ color: '#ffffff' }}>Last Successful Sync:</strong>{' '}
                {paymentStatus.lastSuccessfulSyncTime
                  ? new Date(paymentStatus.lastSuccessfulSyncTime).toLocaleString('en-IN')
                  : 'No sync recorded yet'}
              </div>
              {paymentStatus.lastSyncError && (
                <div style={{ color: '#f87171' }}>
                  <strong style={{ color: '#ffffff' }}>Last Sync Error:</strong> {paymentStatus.lastSyncError}
                </div>
              )}
              <div><strong style={{ color: '#ffffff' }}>Webhook Endpoint:</strong> <code style={{ fontSize: '11px', background: 'rgba(255, 255, 255, 0.08)', color: '#38bdf8', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>/api/payments/webhook</code></div>
            </div>

            {/* Bank Feed Status */}
            <div style={{ backgroundColor: 'rgba(2, 132, 199, 0.12)', border: '1px solid rgba(2, 132, 199, 0.3)', padding: '10px', borderRadius: '8px', marginBottom: '12px' }}>
              <strong style={{ fontSize: '12px', color: '#38bdf8' }}>Authorized Bank Feed Integration</strong>
              <p style={{ fontSize: '11px', color: '#cbd5e1', margin: '4px 0 0 0', lineHeight: '1.4' }}>
                Bank API feeds require formal corporate approval (e.g. ICICI Eazypay, HDFC Corporate Open Banking, Decentro). Direct personal bank account scraping is disabled for compliance and security.
              </p>
            </div>

            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '10px', borderRadius: '8px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f87171', fontWeight: '700', fontSize: '12px' }}>
                <Lock size={13} /> Strict Security Standard
              </div>
              <p style={{ fontSize: '11px', color: '#cbd5e1', margin: '4px 0 0 0', lineHeight: '1.4' }}>
                Never enter or share UPI PIN, OTP, Card PIN, or CVV. Full card numbers are never stored. Transactions are verified exclusively via HMAC cryptographic webhook signatures on the backend.
              </p>
            </div>
          </div>

          {/* Setu Account Aggregator (Bank Linking) Panel */}
          <div className="sleek-panel gateway-panel-sleek" style={{ borderLeft: '4px solid #0284c7' }}>
            <div className="panel-header-compact">
              <div className="flex-align-gap">
                <Building2 size={16} className="text-cyan" />
                <div>
                  <h3 className="panel-heading">Setu Account Aggregator (AA)</h3>
                  <span className="panel-subheading" style={{ fontSize: '11px', color: '#93c5fd' }}>
                    RBI-regulated bank account linking & consent architecture
                  </span>
                </div>
              </div>
              <span
                className={`status-micro-pill ${
                  setuConfig?.configured ? 'pill-profit' : 'pill-amber'
                }`}
              >
                {setuConfig?.configured ? '⚡ AA Sandbox Ready' : '○ Setup Required'}
              </span>
            </div>

            <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.6', marginBottom: '14px' }}>
              <div>
                <strong style={{ color: '#ffffff' }}>Aggregator Gateway:</strong> Setu FIU Sandbox (<code style={{ color: '#38bdf8', background: 'rgba(255, 255, 255, 0.08)', padding: '1px 5px', borderRadius: '4px' }}>{setuConfig?.baseUrl || 'https://fiu-sandbox.setu.co'}</code>)
              </div>
              <div>
                <strong style={{ color: '#ffffff' }}>Product Instance:</strong>{' '}
                <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#38bdf8', background: 'rgba(255, 255, 255, 0.08)', padding: '1px 5px', borderRadius: '4px' }}>
                  {setuConfig?.productInstanceId ? `${setuConfig.productInstanceId.substring(0, 8)}...` : 'Configured in backend .env'}
                </span>
              </div>
              <div>
                <strong style={{ color: '#ffffff' }}>Redirect Target:</strong>{' '}
                <code style={{ fontSize: '11px', background: 'rgba(255, 255, 255, 0.08)', color: '#38bdf8', padding: '2px 5px', borderRadius: '4px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  /setu-callback
                </code>
              </div>
            </div>

            <div style={{ backgroundColor: 'rgba(2, 132, 199, 0.12)', border: '1px solid rgba(2, 132, 199, 0.3)', padding: '10px', borderRadius: '8px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontWeight: '700', fontSize: '12px' }}>
                <ShieldCheck size={14} /> REBIT Financial Information Purpose 101
              </div>
              <p style={{ fontSize: '11px', color: '#cbd5e1', margin: '4px 0 0 0', lineHeight: '1.4' }}>
                Fetches read-only deposit transaction data with customer cryptographic consent. Passwords, MPINs, and OTPs are never stored or requested by our application.
              </p>
            </div>

            {setuError && (
              <div className="alert-compact" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', marginBottom: '12px', padding: '10px 12px', borderRadius: '8px', fontSize: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' }}>
                  <AlertCircle size={15} style={{ flexShrink: 0 }} />
                  <span>{setuError}</span>
                </div>
                {(setuError.includes('Session expired') || setuError.toLowerCase().includes('token')) && (
                  <div style={{ marginTop: '8px' }}>
                    <Link
                      to="/login"
                      className="sleek-btn-primary btn-cyan"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '5px 12px', textDecoration: 'none' }}
                    >
                      Log In to Refresh Session &rarr;
                    </Link>
                  </div>
                )}
                {setuError.includes('INVALID_CREDENTIALS') && (
                  <div style={{ marginTop: '8px', padding: '10px', backgroundColor: '#ffffff', borderRadius: '6px', border: '1px solid #fed7d7', color: '#7f1d1d', lineHeight: '1.5' }}>
                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>💡 Quick Fix in Setu Bridge:</div>
                    <ol style={{ margin: '0 0 6px 16px', padding: 0, fontSize: '11px' }}>
                      <li>Go to <a href="https://bridge.setu.co" target="_blank" rel="noreferrer" style={{ color: '#0284c7', textDecoration: 'underline', fontWeight: '600' }}>bridge.setu.co</a> and open your Account Aggregator product.</li>
                      <li>In <strong>Step 2 — Test your product</strong>, click <strong>"+ Add new"</strong> next to <em>No API credentials added</em>.</li>
                      <li>Copy the generated <strong>Client ID</strong> & <strong>Client Secret</strong> into <code>backend/.env</code>.</li>
                      <li>Restart your backend (<code>npm start</code>) and click the button above again.</li>
                    </ol>
                  </div>
                )}
              </div>
            )}

            {setuResult && (
              <div className="alert-compact alert-success mb-12" style={{ padding: '10px', borderRadius: '6px', fontSize: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', marginBottom: '4px' }}>
                  <CheckCircle size={14} /> Consent Flow Initialized!
                </div>
                <div style={{ fontSize: '11px', color: '#34d399' }}>
                  Consent ID: <code>{setuResult.consentId}</code>
                </div>
                <div style={{ marginTop: '8px' }}>
                  <a
                    href={setuResult.consentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="sleek-btn-primary btn-emerald"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '5px 10px', textDecoration: 'none' }}
                  >
                    Open Setu Consent Screen <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            )}

            <form onSubmit={handleInitiateSetuConsent} className="compact-form">
              <div className="form-group-compact">
                <label className="field-label-compact">Customer Phone (Sandbox Default: 9999999999)</label>
                <input
                  type="text"
                  placeholder="9999999999"
                  value={setuPhone}
                  onChange={(e) => setSetuPhone(e.target.value)}
                  className="sleek-text-input"
                  style={{ fontFamily: 'monospace' }}
                />
                <span style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '4px' }}>
                  Use <code style={{ color: '#38bdf8', background: 'rgba(255, 255, 255, 0.08)', padding: '1px 5px', borderRadius: '4px' }}>9999999999</code> for Setu Sandbox simulated FIP accounts (OTP: <code style={{ color: '#38bdf8', background: 'rgba(255, 255, 255, 0.08)', padding: '1px 5px', borderRadius: '4px' }}>123456</code>).
                </span>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button
                  type="submit"
                  disabled={setuLoading}
                  className="sleek-btn-primary btn-cyan"
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flex: 1 }}
                >
                  {setuLoading ? (
                    <>
                      <RefreshCw size={14} className="spin" /> Creating Consent Session...
                    </>
                  ) : (
                    <>
                      <Building2 size={14} /> Connect Bank via Setu AA <ExternalLink size={13} />
                    </>
                  )}
                </button>
                <Link
                  to="/setu-callback"
                  className="sim-chip-btn"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    textDecoration: 'none',
                    padding: '8px 12px',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    color: '#f1f5f9',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  }}
                  title="View callback inspection page"
                >
                  Inspect Callback
                </Link>
              </div>
            </form>

            {/* Stage 3: Bank Data Fetch Action */}
            <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <strong style={{ fontSize: '12px', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Landmark size={14} className="text-cyan" /> Stage 3: Bank Statement Data Fetch
                </strong>
                <span style={{ fontSize: '10px', color: '#93c5fd' }}>REBIT FI Sessions</span>
              </div>

              {fetchError && (
                <div className="alert-compact" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', marginBottom: '10px', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertCircle size={13} />
                  <span>{fetchError}</span>
                </div>
              )}

              {fetchResult && (
                <div className="alert-compact alert-success mb-10" style={{ padding: '8px 10px', borderRadius: '6px', fontSize: '11px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700' }}>
                    <CheckCircle size={13} />
                    <span>Statement Sync Complete! (Status: {fetchResult.status})</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#6ee7b7', marginTop: '3px', lineHeight: '1.4' }}>
                    • Imported: <strong>{fetchResult.importedCount}</strong> new transaction(s)<br />
                    • Duplicates skipped: <strong>{fetchResult.skippedDuplicates}</strong><br />
                    • Matched with shop records: <strong>{fetchResult.alreadyExistingCount || 0}</strong>
                  </div>
                  <div style={{ marginTop: '6px' }}>
                    <Link to="/transactions" style={{ fontSize: '11px', fontWeight: '700', color: '#34d399', textDecoration: 'underline' }}>
                      View in Transactions / Ledger →
                    </Link>
                  </div>
                </div>
              )}

              <div className="form-group-compact">
                <label className="field-label-compact" style={{ fontSize: '11px' }}>
                  Consent ID to Fetch (auto-filled if approved):
                </label>
                <input
                  type="text"
                  placeholder="e.g. b89e6231-50e5-4a57-b062-8172c72b2a60"
                  value={fetchConsentId || setuResult?.consentId || ''}
                  onChange={(e) => setFetchConsentId(e.target.value)}
                  className="sleek-text-input"
                  style={{ fontFamily: 'monospace', fontSize: '11px', padding: '6px 10px' }}
                />
              </div>

              <button
                type="button"
                disabled={fetchLoading}
                onClick={handleFetchBankTransactions}
                className="sleek-btn-primary btn-emerald"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  width: '100%',
                  fontSize: '12px',
                  padding: '8px 12px',
                  marginTop: '6px',
                }}
              >
                {fetchLoading ? (
                  <>
                    <RefreshCw size={13} className="spin" /> Fetching & Syncing Bank Data...
                  </>
                ) : (
                  <>
                    <Landmark size={13} /> Fetch Bank Transactions (Stage 3)
                  </>
                )}
              </button>
              <span style={{ fontSize: '11px', color: '#cbd5e1', display: 'block', marginTop: '6px', lineHeight: '1.4' }}>
                Calls Setu <code style={{ color: '#38bdf8', background: 'rgba(255, 255, 255, 0.08)', padding: '1px 5px', borderRadius: '4px' }}>POST /sessions</code> &amp; <code style={{ color: '#38bdf8', background: 'rgba(255, 255, 255, 0.08)', padding: '1px 5px', borderRadius: '4px' }}>GET /sessions/:id</code> to import transactions with duplicate protection into History and Dashboard.
              </span>
            </div>
          </div>

          {/* UPI Store VPA Configuration */}
          <div className="sleek-panel gateway-panel-sleek">
            <div className="panel-header-compact">
              <div className="flex-align-gap">
                <Wallet size={15} className="text-purple" />
                <h3 className="panel-heading">Merchant UPI Direct Display</h3>
              </div>
              <span className={`status-micro-pill ${paymentStatus.merchantVpa ? 'pill-profit' : 'pill-standby'}`}>
                {paymentStatus.merchantVpa ? '● VPA Saved' : '○ Standby'}
              </span>
            </div>

            <form onSubmit={handleConnectUpi} className="compact-form">
              <div className="form-group-compact">
                <label className="field-label-compact">UPI Provider</label>
                <select
                  value={upiProvider}
                  onChange={(e) => setUpiProvider(e.target.value)}
                  className="sleek-select-input"
                >
                  <option value="Google Pay">Google Pay (GPay)</option>
                  <option value="PhonePe">PhonePe</option>
                  <option value="Paytm">Paytm</option>
                  <option value="BHIM UPI">BHIM UPI</option>
                  <option value="Razorpay">Razorpay UPI</option>
                  <option value="Cashfree">Cashfree UPI</option>
                </select>
              </div>

              <div className="form-group-compact">
                <label className="field-label-compact">Merchant UPI ID / VPA</label>
                <input
                  type="text"
                  placeholder="e.g. yourname@okhdfcbank, store@okaxis, or 9876543210@paytm"
                  value={merchantVpa}
                  onChange={(e) => setMerchantVpa(e.target.value)}
                  className="sleek-text-input"
                />
              </div>

              <button type="submit" className="sleek-btn-primary btn-emerald">
                Save Merchant VPA
              </button>
            </form>

            <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', padding: '10px', marginTop: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fbbf24', fontWeight: '700', fontSize: '12px' }}>
                Personal UPI Notice & Limitations
              </div>
              <p style={{ fontSize: '11px', color: '#fef3c7', margin: '4px 0 0 0', lineHeight: '1.4' }}>
                Personal VPAs (Google Pay / PhonePe personal handles) do not provide automated transaction history feeds. Automatic ingestion is disabled for personal accounts. Payments must be verified manually or reconciled with the customer's 12-digit UTR reference number.
              </p>
            </div>
          </div>

          {/* Developer Webhook Simulator (Receive & Send Money) */}
          <div className="sleek-panel test-simulator-panel">
            <div className="panel-header-compact">
              <div className="flex-align-gap">
                <Zap size={15} className="text-amber" />
                <h3 className="panel-heading">Sandbox Payment Simulator</h3>
              </div>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: '800',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(245, 158, 11, 0.18)',
                  color: '#fbbf24',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  letterSpacing: '0.04em',
                }}
              >
                TEST PAYMENT — NOT REAL MONEY
              </span>
            </div>

            <p className="micro-notice">
              Simulate HMAC-verified sandbox webhooks for live ledger and real-time SSE updates. Disabled in production.
            </p>

            {testSuccess && (
              <div className="alert-compact alert-success mb-10">
                <CheckCircle size={14} />
                <span>{testSuccess}</span>
              </div>
            )}

            <div className="simulator-actions-strip" style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="sim-chip-btn sim-emerald"
                style={{
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  color: '#ffffff',
                  border: '1px solid #34d399',
                  padding: '9px 16px',
                  borderRadius: '8px',
                  fontWeight: '700',
                  fontSize: '12px',
                  boxShadow: '0 2px 10px rgba(5, 150, 105, 0.35)',
                }}
                onClick={() => handleRunSimulatedPayment('received', 500, 'UPI')}
              >
                <ArrowDownLeft size={14} /> Test Inflow: +₹500 (Sale)
              </button>
              <button
                type="button"
                className="sim-chip-btn sim-rose"
                style={{
                  background: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
                  color: '#ffffff',
                  border: '1px solid #f87171',
                  padding: '9px 16px',
                  borderRadius: '8px',
                  fontWeight: '700',
                  fontSize: '12px',
                  boxShadow: '0 2px 10px rgba(225, 29, 72, 0.35)',
                }}
                onClick={() => handleRunSimulatedPayment('sent', 350, 'UPI', 'Stock')}
              >
                <ArrowUpRight size={14} /> Test Outflow: -₹350 (Expense)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
