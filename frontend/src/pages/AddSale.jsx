import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import {
  createSale,
  getPaymentStatus,
  getAutomaticPayments,
  simulateTestPayment,
  createRazorpayOrder,
  verifyRazorpayOrder,
  syncGatewayPayments,
  checkLivePayment,
  checkReferenceUtr,
} from '../services/api';
import useRealtimeEvents from '../hooks/useRealtimeEvents';
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
  RefreshCw,
  Radio,
  ExternalLink,
  CheckCircle2,
  Lock,
} from 'lucide-react';

const AddSale = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash'); // 'Cash' | 'UPI' | 'Card'
  const [upiApp, setUpiApp] = useState('Google Pay');
  const [utrNumber, setUtrNumber] = useState('');
  const [utrWarning, setUtrWarning] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [syncingGateway, setSyncingGateway] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState('');

  const handleUtrBlur = async () => {
    if (!utrNumber || utrNumber.trim().length < 6) {
      setUtrWarning('');
      return;
    }
    try {
      const res = await checkReferenceUtr(utrNumber.trim());
      if (res && res.exists) {
        setUtrWarning(
          `⚠️ Duplicate UTR Warning: Reference "${utrNumber.trim()}" was already recorded in a ₹${res.transaction?.amount} payment on ${new Date(res.transaction?.date || res.transaction?.createdAt).toLocaleDateString('en-IN')}. Please check receipt.`
        );
      } else {
        setUtrWarning('');
      }
    } catch {
      setUtrWarning('');
    }
  };

  // Real-time payment detection states
  const [isProcessingRazorpay, setIsProcessingRazorpay] = useState(false);
  const [capturedPayment, setCapturedPayment] = useState(null); // { amount, provider, utrNumber, paymentId }
  const listeningStartRef = useRef(Date.now());

  const upiAppOptions = ['Google Pay', 'PhonePe', 'Paytm', 'BHIM', 'Other UPI'];

  // Connection & Automatic payments state
  const [connectionStatus, setConnectionStatus] = useState({
    upiConnected: false,
    cardConnected: false,
    providerName: 'UPI',
    merchantVpa: '',
    upiProvider: 'UPI',
  });
  const [autoPayments, setAutoPayments] = useState([]);

  const fetchPaymentData = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchPaymentData();
  }, [fetchPaymentData]);

  // Reset listening timestamp when amount or payment method changes
  useEffect(() => {
    listeningStartRef.current = Date.now();
    setCapturedPayment(null);
  }, [amount, paymentMethod]);

  // Real-Time Event Subscription (SSE)
  useRealtimeEvents({
    onPaymentSuccess: (eventData) => {
      console.log('[REAL-TIME] Payment received on AddSale:', eventData);
      const incomingAmount = Number(eventData.amount);
      const currentExpected = Number(amount);

      // If waiting for payment, or if amount matches / is close
      if (
        (paymentMethod === 'UPI' || paymentMethod === 'Card') &&
        (!currentExpected || Math.abs(incomingAmount - currentExpected) < 0.01)
      ) {
        setCapturedPayment({
          amount: incomingAmount,
          provider: eventData.provider || 'UPI',
          paymentMethod: eventData.paymentMethod || 'UPI',
          utrNumber: eventData.utrNumber || eventData.providerPaymentId,
          paymentId: eventData.providerPaymentId,
        });
        setSuccess(`Payment of ₹${incomingAmount} received via ${eventData.provider || 'UPI'}!`);
        fetchPaymentData();
      }
    },
    onSaleCreated: () => {
      fetchPaymentData();
    },
  });

  // Fallback Polling (Checks every 3.5 seconds if customer paid while showing QR)
  useEffect(() => {
    const isListening = (paymentMethod === 'UPI' || paymentMethod === 'Card') && Number(amount) > 0 && !capturedPayment;
    if (!isListening) return;

    const interval = setInterval(async () => {
      try {
        const res = await checkLivePayment({
          amount: Number(amount),
          since: listeningStartRef.current,
        });

        if (res.found && res.payment) {
          console.log('[LIVE POLL] Captured live payment:', res.payment);
          setCapturedPayment({
            amount: res.payment.amount,
            provider: res.payment.provider,
            paymentMethod: res.payment.paymentMethod,
            utrNumber: res.payment.utrNumber,
            paymentId: res.payment.id,
          });
          setSuccess(`Payment of ₹${res.payment.amount} detected in real-time via ${res.payment.provider}!`);
          fetchPaymentData();
        }
      } catch (err) {
        // Suppress poll errors
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [amount, paymentMethod, capturedPayment, fetchPaymentData]);

  const handleQuickAdd = (preset) => {
    const current = Number(amount) || 0;
    setAmount((current + preset).toString());
  };

  // Launch official Razorpay Checkout modal
  const handlePayWithRazorpay = async () => {
    const orderAmount = Number(amount);
    if (!orderAmount || orderAmount <= 0) {
      setError('Please enter a valid sale amount first.');
      return;
    }

    if (!window.Razorpay) {
      setError('Razorpay SDK is loading. Please check your internet connection.');
      return;
    }

    setError('');
    setIsProcessingRazorpay(true);

    try {
      // 1. Create order on server
      const orderRes = await createRazorpayOrder({
        amount: orderAmount,
        notes: {
          description: description || 'Counter Retail Sale',
        },
      });

      const orderData = orderRes.order;

      // 2. Open Razorpay Checkout modal
      const options = {
        key: orderData.key,
        amount: Math.round(orderAmount * 100),
        currency: orderData.currency || 'INR',
        name: 'Smart Business Shop',
        description: description || 'Counter Sale Bill',
        order_id: orderData.orderId,
        theme: {
          color: '#10b981',
        },
        handler: async (response) => {
          try {
            setLoading(true);
            const verifyRes = await verifyRazorpayOrder({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              amount: orderAmount,
              description: description || `Razorpay counter payment [${response.razorpay_payment_id}]`,
            });

            setCapturedPayment({
              amount: orderAmount,
              provider: 'Razorpay',
              paymentMethod: verifyRes.method || 'UPI',
              utrNumber: response.razorpay_payment_id,
              paymentId: response.razorpay_payment_id,
            });

            setSuccess(`Payment of ₹${orderAmount} verified live via Razorpay! Sale registered.`);
            setAmount('');
            setDescription('');
            setUtrNumber('');
            await fetchPaymentData();

            setTimeout(() => {
              navigate('/transactions');
            }, 1500);
          } catch (verErr) {
            setError('Payment verification failed: ' + (verErr.response?.data?.message || verErr.message));
          } finally {
            setLoading(false);
            setIsProcessingRazorpay(false);
          }
        },
        modal: {
          ondismiss: () => {
            setIsProcessingRazorpay(false);
          },
        },
        prefill: {
          name: 'Walk-in Customer',
          email: 'customer@store.com',
          contact: '9876543210',
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to start Razorpay payment.');
      setIsProcessingRazorpay(false);
    }
  };

  // Trigger manual gateway sync from Razorpay API
  const handleSyncGateway = async () => {
    try {
      setSyncingGateway(true);
      setSyncFeedback('');
      const res = await syncGatewayPayments();
      setSyncFeedback(res.message);
      await fetchPaymentData();
      setTimeout(() => setSyncFeedback(''), 4500);
    } catch (err) {
      setSyncFeedback('Gateway sync failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setSyncingGateway(false);
    }
  };

  // Manual save sale (for cash or manual entry)
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
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Quick simulation helper
  const handleQuickSimulate = async () => {
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
        note: `Customer paid ₹${simAmount} via ${upiApp}`,
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

  // Dynamic QR Code generation for UPI
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
          <h2 className="section-title">Sales & Real-Time Payment Ingestion</h2>
          <p className="section-subtitle">
            Accept Cash, UPI (Google Pay, PhonePe, Paytm, BHIM) and Razorpay with automated real-time payment fetching
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
                <span className="panel-subheading">Counter bill entry & digital payments</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => navigate('/scan')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '5px 12px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
                }}
              >
                <QrCode size={13} />
                <span>Scan Product QR</span>
              </button>
              <span className="pill-active-mode">Direct Entry</span>
            </div>
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

          {/* CAPTURED LIVE PAYMENT CELEBRATION CARD */}
          {capturedPayment && (
            <div
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '2px solid #10b981',
                borderRadius: '12px',
                padding: '14px',
                marginBottom: '16px',
                animation: 'pulse 1.5s infinite alternate',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={22} color="#10b981" />
                  <div>
                    <strong style={{ color: '#065f46', fontSize: '14px' }}>
                      Payment Captured in Real-Time!
                    </strong>
                    <div style={{ fontSize: '12px', color: '#047857' }}>
                      ₹{capturedPayment.amount} received via {capturedPayment.provider}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/transactions')}
                  className="sleek-btn-primary btn-emerald"
                  style={{ padding: '6px 12px', fontSize: '11px' }}
                >
                  View in Ledger
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSaveSale} className="compact-form">
            {/* Payment Method Selector Tabs */}
            <div className="form-group-compact">
              <label className="field-label-compact">{t('paymentMethodLabel') || 'Payment Method'}</label>
              <div className="payment-method-selector-compact">
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
                  className={`pm-pill-btn ${paymentMethod === 'UPI' ? 'pm-pill-active' : ''}`}
                  onClick={() => setPaymentMethod('UPI')}
                >
                  <Smartphone size={14} />
                  <span>UPI & QR</span>
                </button>
                <button
                  type="button"
                  className={`pm-pill-btn ${paymentMethod === 'Card' ? 'pm-pill-active' : ''}`}
                  onClick={() => setPaymentMethod('Card')}
                >
                  <CreditCard size={14} />
                  <span>Card / Razorpay</span>
                </button>
              </div>
            </div>

            {/* If UPI is selected: Choose UPI Provider App equally */}
            {paymentMethod === 'UPI' && (
              <div className="form-group-compact">
                <label className="field-label-compact">Customer Payment App</label>
                <div className="upi-app-strip">
                  {upiAppOptions.map((app) => (
                    <button
                      key={app}
                      type="button"
                      className={`upi-app-chip ${upiApp === app ? 'active-app' : ''}`}
                      onClick={() => setUpiApp(app)}
                    >
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

            {/* Dynamic UPI QR Code Card + Real-time Ingestion Radar */}
            {paymentMethod === 'UPI' && (
              <div className="store-qr-card-compact">
                <div className="qr-card-left">
                  <img
                    src={qrImgSrc}
                    alt="Scan UPI QR"
                    className="store-qr-img"
                    loading="lazy"
                  />
                </div>
                <div className="qr-card-right">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div className="badge-gpay-pill">
                      <QrCode size={13} className="text-cyan" />
                      <span>Live UPI QR</span>
                    </div>
                    {/* Live Listening Radar Badge */}
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '11px',
                        fontWeight: '700',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                        color: '#059669',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                      }}
                    >
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: '#10b981',
                          boxShadow: '0 0 6px #10b981',
                        }}
                      />
                      Live Ingestion Active
                    </span>
                  </div>

                  <strong className="qr-amount-notice">
                    {amount && Number(amount) > 0
                      ? `Scan to pay ₹${Number(amount).toLocaleString('en-IN')}`
                      : 'Scan to pay counter bill'}
                  </strong>
                  <p className="qr-vpa-text">UPI ID: <code>{activeVpa}</code></p>
                  <span className="qr-helper-tip">
                    Customer scans with Google Pay, PhonePe, Paytm, or BHIM.
                  </span>

                  {/* Dual Action Buttons: Pay via Razorpay Checkout & Quick Simulator */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                    <button
                      type="button"
                      onClick={handlePayWithRazorpay}
                      disabled={isProcessingRazorpay || !amount || Number(amount) <= 0}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        backgroundColor: '#0284c7',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(2, 132, 199, 0.2)',
                      }}
                    >
                      <CreditCard size={14} />
                      <span>
                        {isProcessingRazorpay
                          ? 'Opening Gateway...'
                          : `Pay with Razorpay (UPI / Card / NetBanking)`}
                      </span>
                    </button>

                    <button
                      type="button"
                      className="btn-sim-test-inline"
                      onClick={handleQuickSimulate}
                      disabled={simulating}
                    >
                      <Zap size={13} />
                      <span>{simulating ? 'Simulating...' : `⚡ Test: Simulate Incoming ${upiApp} Payment`}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* If Card POS is selected: Direct Razorpay Checkout Option */}
            {paymentMethod === 'Card' && (
              <div
                style={{
                  backgroundColor: 'rgba(59, 130, 246, 0.05)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  borderRadius: '12px',
                  padding: '14px',
                  marginBottom: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <CreditCard size={18} className="text-blue" />
                  <strong style={{ fontSize: '13px' }}>Card POS & Payment Gateway</strong>
                </div>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 10px 0' }}>
                  Collect instant Card, NetBanking, and Wallet payments via Razorpay Gateway with cryptographic signature verification.
                </p>
                <button
                  type="button"
                  onClick={handlePayWithRazorpay}
                  disabled={isProcessingRazorpay || !amount || Number(amount) <= 0}
                  className="sleek-btn-primary btn-cyan"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <CreditCard size={15} />
                  <span>
                    {isProcessingRazorpay ? 'Processing...' : `Pay ₹${amount || '0'} via Razorpay Gateway`}
                  </span>
                </button>
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
                  onChange={(e) => {
                    setUtrNumber(e.target.value);
                    if (utrWarning) setUtrWarning('');
                  }}
                  onBlur={handleUtrBlur}
                  className="sleek-text-input"
                />
                {utrWarning && (
                  <div
                    style={{
                      fontSize: '12px',
                      color: '#92400e',
                      backgroundColor: 'rgba(245, 158, 11, 0.12)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      marginTop: '6px',
                    }}
                  >
                    {utrWarning}
                  </div>
                )}
              </div>
            )}

            {/* Description field */}
            <div className="form-group-compact">
              <label className="field-label-compact">{t('optionalDescription')}</label>
              <input
                type="text"
                placeholder={
                  paymentMethod === 'UPI'
                    ? `e.g. Counter sale paid via ${upiApp}`
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
              className="sleek-btn-primary btn-emerald"
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

        {/* RIGHT COLUMN: CHANNELS & REAL-TIME FETCHING FEED */}
        <div className="side-column-panels">
          {/* Gateway Real-Time Sync Panel */}
          <div className="sleek-panel side-channel-panel">
            <div className="panel-header-compact">
              <div className="flex-align-gap">
                <ShieldCheck size={16} className="text-cyan" />
                <h3 className="panel-heading">Real-Time Gateway Fetching</h3>
              </div>
              <button
                type="button"
                className="link-settings-mini"
                onClick={handleSyncGateway}
                disabled={syncingGateway}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <RefreshCw size={12} className={syncingGateway ? 'spin' : ''} />
                <span>{syncingGateway ? 'Fetching...' : 'Fetch Now'}</span>
              </button>
            </div>

            <p className="micro-notice">
              Connects directly to Razorpay REST API and webhooks to reconcile captured customer payments. Periodic background synchronization runs with concurrency protection.
            </p>

            {syncFeedback && (
              <div className="alert-compact alert-success mb-10">
                <CheckCircle size={14} />
                <span>{syncFeedback}</span>
              </div>
            )}

            <div className="gateway-status-list">
              {/* UPI Channel */}
              <div className="gateway-row-compact">
                <div className="flex-align-gap">
                  <div className="gateway-icon-box bg-purple-soft">
                    <Smartphone size={15} className="text-purple" />
                  </div>
                  <div>
                    <strong className="gw-title">UPI (GPay / PhonePe / Paytm)</strong>
                    <span className="gw-desc">
                      {connectionStatus.merchantVpa || 'QR & Virtual Payment Address'}
                    </span>
                  </div>
                </div>
                <span className="status-micro-pill pill-profit">
                  ● Live Active
                </span>
              </div>

              {/* Razorpay Gateway Channel */}
              <div className="gateway-row-compact">
                <div className="flex-align-gap">
                  <div className="gateway-icon-box bg-blue-soft">
                    <CreditCard size={15} className="text-blue" />
                  </div>
                  <div>
                    <strong className="gw-title">Razorpay API Ingestion</strong>
                    <span className="gw-desc">Direct REST Fetching & Webhooks</span>
                  </div>
                </div>
                <span className="status-micro-pill pill-profit">
                  ● Connected
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
                <span className="micro-hint">Connected UPI deposits appear automatically here.</span>
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
