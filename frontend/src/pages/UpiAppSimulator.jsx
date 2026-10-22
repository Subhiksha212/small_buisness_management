import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { recordUpiPayment, getAutomaticPayments } from '../services/api';
import useRealtimeEvents from '../hooks/useRealtimeEvents';
import {
  Smartphone,
  Send,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  QrCode,
  ShieldCheck,
  Zap,
  RefreshCw,
  Volume2,
  VolumeX,
  Sparkles,
  Building,
  Wallet,
  UserCheck,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  Lock,
  Clock,
  Check,
} from 'lucide-react';

const PRESET_CONTACTS = [
  { name: 'Kirana Wholesale', upi: 'wholesale.supplier@okaxis', category: 'Stock', icon: Building, color: '#3b82f6' },
  { name: 'Dairy & Milk Supply', upi: 'amul.distributor@paytm', category: 'Stock', icon: Building, color: '#06b6d4' },
  { name: 'Shop Landlord', upi: 'store.rent@okhdfcbank', category: 'Rent', icon: Building, color: '#8b5cf6' },
  { name: 'Electricity Board', upi: 'power.board@upi', category: 'Electricity', icon: Zap, color: '#f59e0b' },
  { name: 'Walk-in Customer A', upi: 'rahul.verma@okhdfcbank', category: 'Sale', icon: UserCheck, color: '#10b981' },
  { name: 'Walk-in Customer B', upi: 'priya.sharma@paytm', category: 'Sale', icon: UserCheck, color: '#10b981' },
];

// Play pleasant synthesized UPI payment success chime using Web Audio API
const playUpiChime = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const now = ctx.currentTime;
    // Note 1 (E5 - 659 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.18, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.25);

    // Note 2 (A5 - 880 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.15);
    gain2.gain.setValueAtTime(0.25, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.65);
  } catch (e) {
    // Audio context may be muted or blocked by browser policy
  }
};

const UpiAppSimulator = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  // App Selection: 'Google Pay' | 'Paytm' | 'PhonePe' | 'BHIM'
  const [selectedApp, setSelectedApp] = useState('Google Pay');
  // Flow mode: 'send' (Outflow/Expense) | 'receive' (Inflow/Sale) | 'passbook'
  const [flowMode, setFlowMode] = useState('send');

  // Send Form State
  const [receiverUpi, setReceiverUpi] = useState('wholesale.supplier@okaxis');
  const [sendAmount, setSendAmount] = useState('500');
  const [sendCategory, setSendCategory] = useState('Stock');
  const [sendNote, setSendNote] = useState('Stock purchase payment');

  // Receive Form State
  const [senderUpi, setSenderUpi] = useState('customer@okhdfcbank');
  const [receiveAmount, setReceiveAmount] = useState('350');
  const [receiveNote, setReceiveNote] = useState('Counter retail purchase');

  // Interactive PIN & Flow States
  const [pinState, setPinState] = useState(false); // whether entering PIN
  const [enteredPin, setEnteredPin] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Success Receipt State
  const [successReceipt, setSuccessReceipt] = useState(null);

  // Live UPI Passbook Data
  const [recentUpiTxns, setRecentUpiTxns] = useState([]);
  const [loadingTxns, setLoadingTxns] = useState(false);

  // Current time for mobile clock
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadRecentTransactions = async () => {
    try {
      setLoadingTxns(true);
      const data = await getAutomaticPayments();
      setRecentUpiTxns(data);
    } catch (e) {
      console.error('Error loading recent UPI txns:', e);
    } finally {
      setLoadingTxns(false);
    }
  };

  useEffect(() => {
    loadRecentTransactions();
  }, []);

  // Subscribe to real-time events to auto-refresh the in-app passbook
  useRealtimeEvents({
    onPaymentSuccess: () => loadRecentTransactions(),
    onSaleCreated: () => loadRecentTransactions(),
    onExpenseCreated: () => loadRecentTransactions(),
    onTransactionCreated: () => loadRecentTransactions(),
  });

  // App Theme Colors
  const getAppTheme = () => {
    switch (selectedApp) {
      case 'Paytm':
        return {
          primary: '#002e6e',
          secondary: '#00b9f5',
          bannerBg: 'linear-gradient(135deg, #002970 0%, #00b9f5 100%)',
          accent: '#00b9f5',
          appName: 'Paytm UPI',
        };
      case 'PhonePe':
        return {
          primary: '#5f259f',
          secondary: '#8a3ab9',
          bannerBg: 'linear-gradient(135deg, #4a154b 0%, #5f259f 100%)',
          accent: '#c084fc',
          appName: 'PhonePe',
        };
      case 'BHIM':
        return {
          primary: '#0b6623',
          secondary: '#ff9933',
          bannerBg: 'linear-gradient(135deg, #138808 0%, #000080 50%, #ff9933 100%)',
          accent: '#22c55e',
          appName: 'BHIM UPI',
        };
      case 'Google Pay':
      default:
        return {
          primary: '#1a73e8',
          secondary: '#34a853',
          bannerBg: 'linear-gradient(135deg, #1a73e8 0%, #1e3a8a 100%)',
          accent: '#60a5fa',
          appName: 'Google Pay',
        };
    }
  };

  const theme = getAppTheme();

  // Trigger Send (Pay via UPI ID)
  const handleInitiateSend = (e) => {
    e.preventDefault();
    if (!sendAmount || Number(sendAmount) <= 0) {
      alert('Please enter a valid amount.');
      return;
    }
    if (!receiverUpi.trim()) {
      alert('Please enter a recipient UPI ID.');
      return;
    }
    // Show PIN modal for authentic UPI simulation
    setEnteredPin('');
    setPinState(true);
  };

  // Submit Final Transaction (after PIN verification)
  const handleConfirmAndPay = async () => {
    setIsProcessing(true);
    setPinState(false);

    try {
      const isSending = flowMode === 'send';
      const cleanAmount = Number(isSending ? sendAmount : receiveAmount);
      const payee = isSending ? receiverUpi.trim() : 'Store Counter';
      const payer = isSending ? 'My Business VPA' : senderUpi.trim();
      const randomUtr = `${Math.floor(100000000000 + Math.random() * 900000000000)}`;

      const res = await recordUpiPayment({
        direction: isSending ? 'sent' : 'received',
        amount: cleanAmount,
        upiApp: selectedApp,
        utrNumber: randomUtr,
        paidTo: payee,
        senderReceiver: isSending ? payee : payer,
        senderUpi: isSending ? 'shop@okhdfcbank' : payer,
        receiverUpi: isSending ? payee : 'shop@okhdfcbank',
        category: isSending ? sendCategory : 'Sale',
        note: isSending ? sendNote : receiveNote,
        isTest: true,
      });

      if (soundEnabled) {
        playUpiChime();
      }

      setSuccessReceipt({
        amount: cleanAmount,
        direction: isSending ? 'sent' : 'received',
        payee: isSending ? payee : 'Your Shop',
        payer: isSending ? 'Your Shop' : payer,
        utr: res.utrNumber || randomUtr,
        txnId: res.txnId || `UPI_${randomUtr}`,
        app: selectedApp,
        note: isSending ? sendNote : receiveNote,
        category: isSending ? sendCategory : 'Sale',
        timestamp: new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          day: 'numeric',
          month: 'short',
        }),
      });

      loadRecentTransactions();
    } catch (err) {
      console.error('Payment error:', err);
      alert('Payment simulation failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsProcessing(false);
    }
  };

  // Trigger Receive (Simulate Customer Paying Store)
  const handleInitiateReceive = async (e) => {
    e.preventDefault();
    if (!receiveAmount || Number(receiveAmount) <= 0) {
      alert('Please enter a valid collection amount.');
      return;
    }
    // Direct processing for customer incoming payment
    await handleConfirmAndPay();
  };

  // Reset to new payment
  const handleReset = () => {
    setSuccessReceipt(null);
    setPinState(false);
    setEnteredPin('');
  };

  return (
    <div className="section-page-container">
      {/* Intro Header */}
      <div className="page-intro-bar">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 className="section-title">UPI Payment App Simulator</h2>
            <span
              style={{
                fontSize: '11px',
                fontWeight: '700',
                padding: '2px 8px',
                borderRadius: '999px',
                backgroundColor: 'rgba(234, 179, 8, 0.15)',
                color: '#b45309',
                border: '1px solid rgba(234, 179, 8, 0.3)',
              }}
            >
              Interactive Simulator
            </span>
          </div>
          <p className="section-subtitle">
            Simulate paying or receiving money via Google Pay, Paytm, or PhonePe using dummy UPI IDs. Reflected live on your Dashboard without refreshing!
          </p>
        </div>

        <div className="flex-align-gap">
          <button
            type="button"
            className="sim-chip-btn"
            style={{ backgroundColor: soundEnabled ? 'rgba(16,185,129,0.1)' : 'rgba(100,116,139,0.1)', color: soundEnabled ? '#059669' : '#64748b' }}
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            <span>{soundEnabled ? 'Chime Sound ON' : 'Chime Muted'}</span>
          </button>
          <button
            type="button"
            className="sleek-btn-primary btn-cyan"
            onClick={() => navigate('/')}
          >
            <span>Open Dashboard</span>
            <ExternalLink size={14} />
          </button>
        </div>
      </div>

      {/* Main Grid: Left is Interactive Phone / Canvas, Right is Live Sync Verification Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 480px) 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* ============================================================ */}
        {/* PHONE MOCKUP CONTAINER */}
        {/* ============================================================ */}
        <div
          style={{
            backgroundColor: '#0f172a',
            borderRadius: '36px',
            padding: '12px',
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255,255,255,0.1)',
            maxWidth: '460px',
            margin: '0 auto',
            width: '100%',
          }}
        >
          {/* Phone Screen Inner */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '26px',
              overflow: 'hidden',
              minHeight: '620px',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)',
            }}
          >
            {/* 1. Phone Top Status Bar */}
            <div
              style={{
                backgroundColor: theme.primary,
                color: '#ffffff',
                padding: '8px 16px 4px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '11px',
                fontWeight: '600',
                letterSpacing: '0.02em',
              }}
            >
              <span>{currentTime || '9:41 AM'}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '10px' }}>5G</span>
                <span>📶</span>
                <span>🔋 98%</span>
              </div>
            </div>

            {/* 2. App Selector Tabs (GPay, Paytm, PhonePe, BHIM) */}
            <div
              style={{
                backgroundColor: theme.primary,
                padding: '6px 12px 12px 12px',
                display: 'flex',
                gap: '6px',
                overflowX: 'auto',
              }}
            >
              {['Google Pay', 'Paytm', 'PhonePe', 'BHIM'].map((app) => (
                <button
                  key={app}
                  type="button"
                  onClick={() => setSelectedApp(app)}
                  style={{
                    backgroundColor: selectedApp === app ? '#ffffff' : 'rgba(255,255,255,0.15)',
                    color: selectedApp === app ? theme.primary : '#ffffff',
                    border: 'none',
                    borderRadius: '999px',
                    padding: '5px 12px',
                    fontSize: '11px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Smartphone size={12} />
                  {app}
                </button>
              ))}
            </div>

            {/* 3. Action Mode Switcher (Send / Receive / Passbook) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                backgroundColor: '#f1f5f9',
                padding: '4px',
                margin: '12px 16px',
                borderRadius: '12px',
              }}
            >
              <button
                type="button"
                onClick={() => { setFlowMode('send'); handleReset(); }}
                style={{
                  border: 'none',
                  borderRadius: '8px',
                  padding: '7px 4px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  backgroundColor: flowMode === 'send' ? '#ffffff' : 'transparent',
                  color: flowMode === 'send' ? '#dc2626' : '#64748b',
                  boxShadow: flowMode === 'send' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                }}
              >
                <ArrowUpRight size={13} /> Pay Out
              </button>
              <button
                type="button"
                onClick={() => { setFlowMode('receive'); handleReset(); }}
                style={{
                  border: 'none',
                  borderRadius: '8px',
                  padding: '7px 4px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  backgroundColor: flowMode === 'receive' ? '#ffffff' : 'transparent',
                  color: flowMode === 'receive' ? '#16a34a' : '#64748b',
                  boxShadow: flowMode === 'receive' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                }}
              >
                <ArrowDownLeft size={13} /> Collect
              </button>
              <button
                type="button"
                onClick={() => { setFlowMode('passbook'); handleReset(); }}
                style={{
                  border: 'none',
                  borderRadius: '8px',
                  padding: '7px 4px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  backgroundColor: flowMode === 'passbook' ? '#ffffff' : 'transparent',
                  color: flowMode === 'passbook' ? theme.primary : '#64748b',
                  boxShadow: flowMode === 'passbook' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                }}
              >
                <Wallet size={13} /> Passbook
              </button>
            </div>

            {/* 4. MAIN PHONE SCREEN BODY */}
            <div style={{ flex: 1, padding: '0 16px 16px 16px', overflowY: 'auto' }}>
              
              {/* SUCCESS RECEIPT STATE */}
              {successReceipt && (
                <div style={{ textAlign: 'center', padding: '16px 8px' }}>
                  <div
                    style={{
                      width: '68px',
                      height: '68px',
                      borderRadius: '50%',
                      backgroundColor: '#10b981',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '10px auto 16px auto',
                      boxShadow: '0 10px 25px rgba(16, 185, 129, 0.4)',
                    }}
                  >
                    <Check size={36} strokeWidth={3} />
                  </div>

                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: '700',
                      color: '#059669',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Payment Successful
                  </span>

                  <h3 style={{ fontSize: '28px', fontWeight: '800', margin: '4px 0 2px 0', color: '#0f172a' }}>
                    ₹{Number(successReceipt.amount).toLocaleString('en-IN')}
                  </h3>

                  <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 16px 0' }}>
                    {successReceipt.direction === 'sent'
                      ? `Paid to ${successReceipt.payee}`
                      : `Received from ${successReceipt.payer}`}
                  </p>

                  {/* Transaction Details Box */}
                  <div
                    style={{
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '14px',
                      padding: '12px 14px',
                      textAlign: 'left',
                      fontSize: '12px',
                      lineHeight: '1.6',
                      color: '#334155',
                      marginBottom: '18px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>UPI App</span>
                      <strong>{successReceipt.app}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>UPI Ref / UTR</span>
                      <code style={{ fontSize: '11px', fontWeight: '700' }}>{successReceipt.utr}</code>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Ledger Record</span>
                      <span style={{ fontWeight: '700', color: successReceipt.direction === 'sent' ? '#dc2626' : '#16a34a' }}>
                        {successReceipt.direction === 'sent' ? 'Expense (Outflow)' : 'Sale (Inflow)'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Timestamp</span>
                      <span>{successReceipt.timestamp}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="sleek-btn-primary"
                      style={{ backgroundColor: theme.primary, width: '100%', justifyContent: 'center' }}
                    >
                      New Payment
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/')}
                      className="sim-chip-btn"
                      style={{ justifyContent: 'center', width: '100%', padding: '9px' }}
                    >
                      View in Store Dashboard
                    </button>
                  </div>
                </div>
              )}

              {/* PROCESSING OVERLAY */}
              {isProcessing && (
                <div style={{ textAlign: 'center', padding: '60px 10px' }}>
                  <div className="spinner-border text-cyan" style={{ width: '40px', height: '40px', margin: '0 auto 16px auto' }} />
                  <h4 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 6px 0' }}>
                    Connecting to NPCI & Bank...
                  </h4>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                    Authorizing encrypted UPI payment via {selectedApp}
                  </p>
                </div>
              )}

              {/* AUTHENTIC PIN MODAL SIMULATION */}
              {pinState && !isProcessing && (
                <div style={{ padding: '16px 8px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <button type="button" onClick={() => setPinState(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                      <ArrowLeft size={16} />
                    </button>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>ENTER 4-DIGIT UPI PIN</span>
                    <div style={{ width: '16px' }} />
                  </div>

                  <p style={{ fontSize: '13px', color: '#334155', margin: '0 0 6px 0' }}>
                    Paying <strong>₹{sendAmount}</strong> to {receiverUpi}
                  </p>

                  {/* Masked PIN dots */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', margin: '20px 0' }}>
                    {[0, 1, 2, 3].map((idx) => (
                      <div
                        key={idx}
                        style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          border: '2px solid #94a3b8',
                          backgroundColor: enteredPin.length > idx ? '#0f172a' : 'transparent',
                        }}
                      />
                    ))}
                  </div>

                  {/* Numeric Keypad Simulation */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '10px',
                      maxWidth: '240px',
                      margin: '0 auto 16px auto',
                    }}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                      <button
                        key={digit}
                        type="button"
                        onClick={() => {
                          if (enteredPin.length < 4) setEnteredPin(enteredPin + digit);
                        }}
                        style={{
                          height: '44px',
                          borderRadius: '10px',
                          border: '1px solid #e2e8f0',
                          backgroundColor: '#f8fafc',
                          fontSize: '18px',
                          fontWeight: '700',
                          cursor: 'pointer',
                        }}
                      >
                        {digit}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setEnteredPin('')}
                      style={{
                        height: '44px',
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#f1f5f9',
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      Clear
                    </button>
                    <button
                      key="0"
                      type="button"
                      onClick={() => {
                        if (enteredPin.length < 4) setEnteredPin(enteredPin + '0');
                      }}
                      style={{
                        height: '44px',
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#f8fafc',
                        fontSize: '18px',
                        fontWeight: '700',
                        cursor: 'pointer',
                      }}
                    >
                      0
                    </button>
                    <button
                      type="button"
                      onClick={() => setEnteredPin(enteredPin.slice(0, -1))}
                      style={{
                        height: '44px',
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#f1f5f9',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      ⌫
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleConfirmAndPay}
                    className="sleek-btn-primary"
                    style={{ backgroundColor: '#10b981', width: '100%', justifyContent: 'center' }}
                  >
                    Confirm & Authorize Payment
                  </button>
                </div>
              )}

              {/* FLOW 1: SEND MONEY (PAY OUT) */}
              {flowMode === 'send' && !successReceipt && !isProcessing && !pinState && (
                <form onSubmit={handleInitiateSend}>
                  {/* Preset quick dummy contacts */}
                  <div style={{ marginBottom: '12px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
                      Quick Dummy Recipients
                    </span>
                    <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '6px 0' }}>
                      {PRESET_CONTACTS.filter(c => c.category !== 'Sale').map((contact) => (
                        <button
                          key={contact.upi}
                          type="button"
                          onClick={() => {
                            setReceiverUpi(contact.upi);
                            setSendCategory(contact.category);
                          }}
                          style={{
                            backgroundColor: receiverUpi === contact.upi ? 'rgba(37, 99, 235, 0.1)' : '#f8fafc',
                            border: `1px solid ${receiverUpi === contact.upi ? '#2563eb' : '#e2e8f0'}`,
                            borderRadius: '20px',
                            padding: '4px 10px',
                            fontSize: '11px',
                            fontWeight: '600',
                            color: receiverUpi === contact.upi ? '#1d4ed8' : '#334155',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {contact.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Recipient UPI ID Input (Accepts ANY dummy ID!) */}
                  <div className="form-group-compact" style={{ marginBottom: '10px' }}>
                    <label className="field-label-compact">Recipient UPI ID / VPA</label>
                    <input
                      type="text"
                      placeholder="e.g. vendor@okaxis, friend@paytm, or anything@upi"
                      value={receiverUpi}
                      onChange={(e) => setReceiverUpi(e.target.value)}
                      className="sleek-text-input"
                      required
                    />
                  </div>

                  {/* Amount with quick chips */}
                  <div className="form-group-compact" style={{ marginBottom: '10px' }}>
                    <label className="field-label-compact">Amount to Pay (₹)</label>
                    <input
                      type="number"
                      placeholder="Enter amount"
                      value={sendAmount}
                      onChange={(e) => setSendAmount(e.target.value)}
                      className="sleek-text-input"
                      style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a' }}
                      min="1"
                      required
                    />
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                      {['100', '250', '500', '1000', '2500'].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setSendAmount(amt)}
                          style={{
                            backgroundColor: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '2px 8px',
                            fontSize: '11px',
                            fontWeight: '700',
                            color: '#334155',
                            cursor: 'pointer',
                          }}
                        >
                          +₹{amt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Category & Note */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                    <div className="form-group-compact">
                      <label className="field-label-compact">Category</label>
                      <select
                        value={sendCategory}
                        onChange={(e) => setSendCategory(e.target.value)}
                        className="sleek-select-input"
                      >
                        <option value="Stock">Stock Purchase</option>
                        <option value="Rent">Shop Rent</option>
                        <option value="Electricity">Electricity</option>
                        <option value="Salary">Salary</option>
                        <option value="Transport">Transport</option>
                        <option value="Other">Other Expense</option>
                      </select>
                    </div>

                    <div className="form-group-compact">
                      <label className="field-label-compact">Note</label>
                      <input
                        type="text"
                        placeholder="e.g. Veg supplies"
                        value={sendNote}
                        onChange={(e) => setSendNote(e.target.value)}
                        className="sleek-text-input"
                      />
                    </div>
                  </div>

                  {/* Big Action Button */}
                  <button
                    type="submit"
                    className="sleek-btn-primary"
                    style={{
                      backgroundColor: theme.primary,
                      width: '100%',
                      padding: '12px',
                      fontSize: '14px',
                      fontWeight: '700',
                      justifyContent: 'center',
                    }}
                  >
                    <span>Pay ₹{sendAmount || 0} via {selectedApp}</span>
                    <Send size={15} />
                  </button>
                </form>
              )}

              {/* FLOW 2: RECEIVE MONEY (COLLECT / INFLOW) */}
              {flowMode === 'receive' && !successReceipt && !isProcessing && (
                <form onSubmit={handleInitiateReceive}>
                  <div style={{ textAlign: 'center', marginBottom: '14px' }}>
                    {/* Live Dynamic Store QR preview */}
                    <div
                      style={{
                        display: 'inline-block',
                        padding: '10px',
                        backgroundColor: '#ffffff',
                        border: '2px solid #e2e8f0',
                        borderRadius: '16px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                      }}
                    >
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(
                          `upi://pay?pa=shop@okhdfcbank&pn=SmartBusiness&am=${receiveAmount || 0}&cu=INR`
                        )}`}
                        alt="Store UPI QR"
                        style={{ width: '130px', height: '130px', display: 'block' }}
                      />
                    </div>
                    <p style={{ fontSize: '11px', color: '#64748b', margin: '6px 0 0 0' }}>
                      Scan with any UPI App to pay <strong>₹{receiveAmount || 0}</strong>
                    </p>
                  </div>

                  {/* Customer UPI Input */}
                  <div className="form-group-compact" style={{ marginBottom: '10px' }}>
                    <label className="field-label-compact">Customer UPI ID / Name</label>
                    <input
                      type="text"
                      placeholder="e.g. customer@okhdfcbank or walkin.customer@upi"
                      value={senderUpi}
                      onChange={(e) => setSenderUpi(e.target.value)}
                      className="sleek-text-input"
                      required
                    />
                  </div>

                  {/* Amount to collect */}
                  <div className="form-group-compact" style={{ marginBottom: '12px' }}>
                    <label className="field-label-compact">Amount Received (₹)</label>
                    <input
                      type="number"
                      placeholder="Enter amount"
                      value={receiveAmount}
                      onChange={(e) => setReceiveAmount(e.target.value)}
                      className="sleek-text-input"
                      style={{ fontSize: '20px', fontWeight: '800', color: '#16a34a' }}
                      min="1"
                      required
                    />
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                      {['50', '150', '350', '500', '1200'].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setReceiveAmount(amt)}
                          style={{
                            backgroundColor: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '2px 8px',
                            fontSize: '11px',
                            fontWeight: '700',
                            color: '#15803d',
                            cursor: 'pointer',
                          }}
                        >
                          ₹{amt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 1-Click Simulate Button */}
                  <button
                    type="submit"
                    className="sleek-btn-primary"
                    style={{
                      backgroundColor: '#10b981',
                      width: '100%',
                      padding: '12px',
                      fontSize: '14px',
                      fontWeight: '700',
                      justifyContent: 'center',
                    }}
                  >
                    <span>Receive ₹{receiveAmount || 0} via {selectedApp}</span>
                    <ArrowDownLeft size={15} />
                  </button>
                </form>
              )}

              {/* FLOW 3: PASSBOOK (IN-APP RECENT TXNS) */}
              {flowMode === 'passbook' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a' }}>Recent UPI Activity</span>
                    <button
                      type="button"
                      onClick={loadRecentTransactions}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: theme.primary }}
                    >
                      <RefreshCw size={13} className={loadingTxns ? 'animate-spin' : ''} />
                    </button>
                  </div>

                  {recentUpiTxns.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 10px', color: '#64748b', fontSize: '12px' }}>
                      No simulated UPI transactions yet. Try paying or receiving above!
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {recentUpiTxns.slice(0, 8).map((tx) => (
                        <div
                          key={tx._id}
                          style={{
                            backgroundColor: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '10px',
                            padding: '8px 10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                backgroundColor: tx.direction === 'sent' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                color: tx.direction === 'sent' ? '#dc2626' : '#16a34a',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {tx.direction === 'sent' ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                            </div>
                            <div>
                              <div style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b' }}>
                                {tx.provider || 'UPI'} • {tx.type}
                              </div>
                              <div style={{ fontSize: '10px', color: '#64748b' }}>
                                {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>

                          <div
                            style={{
                              fontSize: '13px',
                              fontWeight: '800',
                              color: tx.direction === 'sent' ? '#dc2626' : '#16a34a',
                            }}
                          >
                            {tx.direction === 'sent' ? '-' : '+'}₹{Number(tx.amount).toLocaleString('en-IN')}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Phone Bottom Home Indicator */}
            <div style={{ padding: '8px 0', textAlign: 'center', backgroundColor: '#ffffff' }}>
              <div
                style={{
                  width: '90px',
                  height: '4px',
                  borderRadius: '999px',
                  backgroundColor: '#94a3b8',
                  margin: '0 auto',
                }}
              />
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* RIGHT SIDE: LIVE STORE VERIFICATION & EXPLANATION */}
        {/* ============================================================ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Quick Shortcuts to verify reflection */}
          <div className="sleek-panel" style={{ padding: '20px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '700', margin: '0 0 12px 0' }}>
              Check Reflection in Store System:
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="sim-chip-btn sim-emerald"
                style={{ padding: '12px', justifyContent: 'center', fontSize: '13px' }}
              >
                <span>Check Dashboard Totals</span>
                <ArrowRight size={14} />
              </button>
              <button
                type="button"
                onClick={() => navigate('/transactions')}
                className="sim-chip-btn sim-rose"
                style={{ padding: '12px', justifyContent: 'center', fontSize: '13px' }}
              >
                <span>Check History & Ledger</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpiAppSimulator;
