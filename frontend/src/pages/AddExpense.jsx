import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { createExpense, simulateTestPayment } from '../services/api';
import {
  CheckCircle,
  AlertCircle,
  Save,
  ScanLine,
  Edit3,
  Package,
  Home,
  Zap,
  Users,
  Truck,
  MoreHorizontal,
  Banknote,
  Smartphone,
  CreditCard,
  TrendingDown,
  Info,
  UserCheck,
} from 'lucide-react';

const AddExpense = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Stock');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [upiApp, setUpiApp] = useState('Google Pay');
  const [paidTo, setPaidTo] = useState('');
  const [utrNumber, setUtrNumber] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [simulating, setSimulating] = useState(false);

  const categories = [
    { id: 'Stock', labelKey: 'categoryStock', icon: Package },
    { id: 'Rent', labelKey: 'categoryRent', icon: Home },
    { id: 'Electricity', labelKey: 'categoryElectricity', icon: Zap },
    { id: 'Salary', labelKey: 'categorySalary', icon: Users },
    { id: 'Transport', labelKey: 'categoryTransport', icon: Truck },
    { id: 'Other', labelKey: 'categoryOther', icon: MoreHorizontal },
  ];

  const paymentMethods = [
    { id: 'Cash', labelKey: 'cash', icon: Banknote, label: 'Cash' },
    { id: 'UPI', labelKey: 'upi', icon: Smartphone, label: 'UPI' },
    { id: 'Card', labelKey: 'card', icon: CreditCard, label: 'Card' },
  ];

  const upiAppOptions = ['Google Pay', 'PhonePe', 'Paytm', 'BHIM', 'Other UPI'];

  const handleQuickAdd = (preset) => {
    const current = Number(amount) || 0;
    setAmount((current + preset).toString());
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!amount || Number(amount) <= 0) {
      setError(t('enterAmountError'));
      return;
    }

    if (!category) {
      setError('Please select an expense category.');
      return;
    }

    try {
      setLoading(true);
      const recipient = paidTo.trim();
      const defaultDesc = recipient
        ? `Paid to ${recipient} (${category})`
        : paymentMethod === 'UPI'
        ? `${category} paid via ${upiApp}`
        : `${category} Expense`;

      await createExpense({
        amount: Number(amount),
        category,
        paymentMethod,
        paidTo: recipient,
        upiApp: paymentMethod === 'UPI' ? upiApp : '',
        utrNumber: utrNumber ? utrNumber.trim() : '',
        description: description.trim() || defaultDesc,
        entryMethod: 'manual',
      });

      setSuccess(
        recipient
          ? `₹${amount} payment to ${recipient} recorded successfully!`
          : paymentMethod === 'UPI'
          ? `₹${amount} paid via ${upiApp} recorded!`
          : t('expenseAddedSuccess')
      );
      setAmount('');
      setPaidTo('');
      setDescription('');
      setUtrNumber('');

      setTimeout(() => {
        navigate('/transactions');
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateSend = async () => {
    const simAmount = Number(amount) > 0 ? Number(amount) : 350;
    const recipient = paidTo.trim() || 'Vendor / Payee';
    setError('');
    setSuccess('');
    try {
      setSimulating(true);
      const res = await simulateTestPayment({
        amount: simAmount,
        provider: upiApp,
        direction: 'sent',
        upiApp: upiApp,
        paidTo: recipient,
        category: category || 'Other',
        note: `Paid ${recipient} ₹${simAmount} for ${category} via ${upiApp}`,
      });
      setSuccess(res.message || `₹${simAmount} sent to ${recipient} via ${upiApp}! Recorded in expenses.`);
      setAmount('');
      setPaidTo('');
      setUtrNumber('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to simulate expense');
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="section-page-container">
      {/* Page Title & Breadcrumb */}
      <div className="page-intro-bar">
        <div>
          <h2 className="section-title">Expense Management</h2>
          <p className="section-subtitle">Track payments made to anyone — suppliers, rent, bills, staff, or individuals</p>
        </div>

        {/* Compact Mode Switcher */}
        <div className="compact-mode-switcher">
          <button className="mode-toggle-btn active">
            <Edit3 size={14} />
            <span>Manual Entry</span>
          </button>
          <button className="mode-toggle-btn" onClick={() => navigate('/scan')}>
            <ScanLine size={14} />
            <span>Scan Receipt</span>
          </button>
        </div>
      </div>

      <div className="split-grid-layout">
        {/* LEFT COLUMN: COMPACT EXPENSE FORM */}
        <div className="sleek-panel main-form-panel">
          <div className="panel-header-compact">
            <div className="flex-align-gap">
              <span className="icon-badge-round badge-loss">
                <TrendingDown size={16} />
              </span>
              <div>
                <h3 className="panel-heading">Record Payment / Outflow</h3>
                <span className="panel-subheading">Log cash, UPI, or card payment to any person or vendor</span>
              </div>
            </div>
            <span className="pill-active-mode mode-rose">Expense Voucher</span>
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

          <form onSubmit={handleSave} className="compact-form">
            {/* Payment Method Selector */}
            <div className="form-group-compact">
              <label className="field-label-compact">{t('paymentMethodQuestion')}</label>
              <div className="payment-method-selector-compact">
                {paymentMethods.map((pm) => {
                  const Icon = pm.icon;
                  const isActive = paymentMethod === pm.id;
                  return (
                    <button
                      key={pm.id}
                      type="button"
                      className={`pm-pill-btn ${isActive ? 'pm-pill-active' : ''}`}
                      onClick={() => setPaymentMethod(pm.id)}
                    >
                      <Icon size={14} />
                      <span>{pm.label || t(pm.labelKey)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* If UPI chosen: Select UPI App (Google Pay, PhonePe, Paytm, BHIM, Other UPI equally) */}
            {paymentMethod === 'UPI' && (
              <div className="form-group-compact">
                <label className="field-label-compact">UPI Payment App</label>
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
              <label className="field-label-compact">{t('expenseAmountQuestion')}</label>
              <div className="luxury-amount-box box-loss-focus">
                <span className="amount-currency-symbol text-loss">₹</span>
                <input
                  type="number"
                  min="1"
                  step="any"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="luxury-amount-input text-loss"
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
                    className="preset-chip preset-chip-loss"
                    onClick={() => handleQuickAdd(preset)}
                  >
                    +₹{preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Paid To / Payee Name (Enter any person or entity) */}
            <div className="form-group-compact">
              <label className="field-label-compact">
                Paid To / Recipient Name (Pay Anyone)
              </label>
              <div className="sleek-input-with-icon">
                <UserCheck size={15} className="input-inner-icon text-muted" />
                <input
                  type="text"
                  placeholder="e.g. Ramesh, Landlord, Wholesale Distributor, Delivery Boy, Staff"
                  value={paidTo}
                  onChange={(e) => setPaidTo(e.target.value)}
                  className="sleek-text-input pl-icon"
                />
              </div>
            </div>

            {/* Category Selector Grid */}
            <div className="form-group-compact">
              <label className="field-label-compact">{t('expenseCategoryQuestion')}</label>
              <div className="category-micro-grid">
                {categories.map((cat) => {
                  const Icon = cat.icon;
                  const isActive = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      className={`cat-micro-card ${isActive ? 'active-loss' : ''}`}
                      onClick={() => setCategory(cat.id)}
                    >
                      <Icon size={15} className="cat-icon" />
                      <span className="cat-label">{t(cat.labelKey)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* UTR / Reference for UPI outflow */}
            {paymentMethod === 'UPI' && (
              <div className="form-group-compact">
                <label className="field-label-compact">
                  12-Digit UTR or Recipient UPI ID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 552275918847 or receiver@upi"
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
                  paidTo
                    ? `e.g. Paid to ${paidTo} for ${category}`
                    : 'e.g. Monthly rent, shop maintenance, raw materials batch #10'
                }
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="sleek-text-input"
              />
            </div>

            {/* Quick Simulate Button for Testing Outflow */}
            {paymentMethod === 'UPI' && (
              <div className="sim-helper-box-loss">
                <button
                  type="button"
                  className="btn-sim-test-inline"
                  onClick={handleSimulateSend}
                  disabled={simulating}
                >
                  <Zap size={13} />
                  <span>
                    {simulating
                      ? 'Simulating...'
                      : `⚡ Test: Simulate Outgoing ${upiApp} Payment`}
                  </span>
                </button>
              </div>
            )}

            {/* Submit button */}
            <button type="submit" className="sleek-btn-primary btn-rose" disabled={loading}>
              <Save size={16} />
              <span>
                {loading
                  ? 'Recording...'
                  : paymentMethod === 'UPI'
                  ? `Record ${upiApp} Expense`
                  : t('saveExpense')}
              </span>
            </button>
          </form>
        </div>

        {/* RIGHT COLUMN: HELPFUL TIPS & QUICK SUMMARY */}
        <div className="side-column-panels">
          <div className="sleek-panel expense-guidance-panel">
            <div className="panel-header-compact">
              <div className="flex-align-gap">
                <Info size={16} className="text-cyan" />
                <h3 className="panel-heading">Payment Tracking Guidance</h3>
              </div>
            </div>

            <div className="tips-list-compact">
              <div className="tip-item">
                <div className="tip-bullet">01</div>
                <div>
                  <strong>Pay Anyone Supported</strong>
                  <p>Enter any person or company name in the <em>Paid To</em> field (suppliers, staff, landlords, or local vendors) for clear accounting history.</p>
                </div>
              </div>

              <div className="tip-item">
                <div className="tip-bullet">02</div>
                <div>
                  <strong>All UPI Apps Tracked</strong>
                  <p>Select whichever UPI app you used — Google Pay, PhonePe, Paytm, or BHIM. All UPI transactions record seamlessly into your balance.</p>
                </div>
              </div>

              <div className="tip-item">
                <div className="tip-bullet">03</div>
                <div>
                  <strong>Smart OCR Scan</strong>
                  <p>Have physical cash memos or receipts? Use <em>Scan Receipt</em> to extract vendor, items, and totals automatically.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddExpense;
