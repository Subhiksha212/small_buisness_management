import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Store, Utensils, User, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import illustration from '../assets/onboarding_illustration.jpg';

const Onboarding = () => {
  const { user, updateOnboarding } = useAuth();
  const { setLanguage } = useLanguage();
  const navigate = useNavigate();

  const [accountType, setAccountType] = useState('retail');
  const [businessName, setBusinessName] = useState(user?.name || '');
  const [businessCategory, setBusinessCategory] = useState('General Retail');
  const [restaurantType, setRestaurantType] = useState('Dine-in / Family Restaurant');
  const [currency, setCurrency] = useState('INR (₹)');
  const [preferredLanguage, setPreferredLanguage] = useState('en');

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const setupData = {
      accountType,
      businessName: accountType === 'personal' ? user?.name || businessName : businessName,
      businessCategory: accountType === 'retail' ? businessCategory : accountType === 'restaurant' ? restaurantType : undefined,
      currency,
      preferredLanguage,
    };

    if (accountType !== 'personal' && !businessName.trim()) {
      setError('Please enter your business / restaurant name.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await updateOnboarding(setupData);
      if (res.success) {
        setLanguage(preferredLanguage);
        navigate('/');
      } else {
        setError(res.message || 'Setup failed.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error completing account setup.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-template-container">
      <div className="login-template-left" style={{ overflowY: 'auto', flex: '0 0 55%', padding: '40px 8%' }}>
        <div className="login-template-brand">
          Smart Business
        </div>

        <div className="login-template-form-wrapper" style={{ maxWidth: '100%', marginTop: '40px' }}>
          <h1 style={{ fontSize: '32px' }}>Set up your account</h1>
          <p className="login-template-subtitle">Choose your usage mode and customize your experience</p>

          {error && (
            <div className="auth-error-banner" style={{ fontSize: '12px', padding: '10px', marginBottom: '24px' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="account-type-section">
            <label className="login-template-input-group" style={{ display: 'block', marginBottom: '12px' }}>
              <label>How will you use Smart Business Manager?</label>
            </label>

            <div className="account-type-grid" style={{ marginBottom: '32px' }}>
              <div
                className={`type-card ${accountType === 'retail' ? 'selected' : ''}`}
                onClick={() => setAccountType('retail')}
                style={{ padding: '12px', border: accountType === 'retail' ? '2px solid #3b82f6' : '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', background: accountType === 'retail' ? '#eff6ff' : '#fff' }}
              >
                <div className="type-icon-wrapper retail-icon" style={{ width: '40px', height: '40px' }}>
                  <Store size={24} />
                </div>
                <div className="type-info">
                  <h3 style={{ fontSize: '14px', color: '#1e293b' }}>RETAIL / SHOP</h3>
                  <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Track products, stock, sales, cash flow, and alerts</p>
                </div>
                {accountType === 'retail' && <CheckCircle2 size={20} className="check-icon" />}
              </div>

              <div
                className={`type-card ${accountType === 'restaurant' ? 'selected' : ''}`}
                onClick={() => setAccountType('restaurant')}
                style={{ padding: '12px', border: accountType === 'restaurant' ? '2px solid #3b82f6' : '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', background: accountType === 'restaurant' ? '#eff6ff' : '#fff' }}
              >
                <div className="type-icon-wrapper restaurant-icon" style={{ width: '40px', height: '40px' }}>
                  <Utensils size={24} />
                </div>
                <div className="type-info">
                  <h3 style={{ fontSize: '14px', color: '#1e293b' }}>RESTAURANT</h3>
                  <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Manage menu items, ingredients, dishes, and sales</p>
                </div>
                {accountType === 'restaurant' && <CheckCircle2 size={20} className="check-icon" />}
              </div>

              <div
                className={`type-card ${accountType === 'personal' ? 'selected' : ''}`}
                onClick={() => setAccountType('personal')}
                style={{ padding: '12px', border: accountType === 'personal' ? '2px solid #3b82f6' : '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', background: accountType === 'personal' ? '#eff6ff' : '#fff' }}
              >
                <div className="type-icon-wrapper personal-icon" style={{ width: '40px', height: '40px' }}>
                  <User size={24} />
                </div>
                <div className="type-info">
                  <h3 style={{ fontSize: '14px', color: '#1e293b' }}>PERSONAL USE</h3>
                  <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Track personal income, expenses, and savings</p>
                </div>
                {accountType === 'personal' && <CheckCircle2 size={20} className="check-icon" />}
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {accountType === 'retail' && (
              <>
                <div className="login-template-input-group">
                  <label>Business / Shop Name</label>
                  <input
                    type="text"
                    className="login-template-input"
                    placeholder="e.g. ABC Supermarket"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    required
                  />
                </div>
                <div className="login-template-input-group">
                  <label>Business Category</label>
                  <select
                    className="login-template-input"
                    value={businessCategory}
                    onChange={(e) => setBusinessCategory(e.target.value)}
                  >
                    <option value="Grocery & Supermarket">Grocery & Supermarket</option>
                    <option value="General Store / Kirana">General Store / Kirana</option>
                    <option value="Electronics & Mobile">Electronics & Mobile</option>
                    <option value="Apparel & Clothing">Apparel & Clothing</option>
                    <option value="Pharmacy & Healthcare">Pharmacy & Healthcare</option>
                    <option value="Hardware & Construction">Hardware & Construction</option>
                    <option value="Other Retail">Other Retail</option>
                  </select>
                </div>
              </>
            )}

            {accountType === 'restaurant' && (
              <>
                <div className="login-template-input-group">
                  <label>Restaurant Name</label>
                  <input
                    type="text"
                    className="login-template-input"
                    placeholder="e.g. Spice Cafe"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    required
                  />
                </div>
                <div className="login-template-input-group">
                  <label>Restaurant Type</label>
                  <select
                    className="login-template-input"
                    value={restaurantType}
                    onChange={(e) => setRestaurantType(e.target.value)}
                  >
                    <option value="Dine-in / Family Restaurant">Dine-in / Family Restaurant</option>
                    <option value="Fast Food / Quick Service">Fast Food / Quick Service</option>
                    <option value="Cafe & Coffee Shop">Cafe & Coffee Shop</option>
                    <option value="Bakery & Confectionery">Bakery & Confectionery</option>
                    <option value="Food Truck / Stalls">Food Truck / Stalls</option>
                    <option value="Other Food Business">Other Food Business</option>
                  </select>
                </div>
              </>
            )}

            {accountType === 'personal' && (
              <div className="login-template-input-group">
                <label>Display Name</label>
                <input
                  type="text"
                  className="login-template-input"
                  placeholder="Your name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                />
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="login-template-input-group">
                <label>Currency</label>
                <select className="login-template-input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  <option value="INR (₹)">INR (₹)</option>
                  <option value="USD ($)">USD ($)</option>
                  <option value="EUR (€)">EUR (€)</option>
                </select>
              </div>

              <div className="login-template-input-group">
                <label>Preferred Language</label>
                <select
                  className="login-template-input"
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage(e.target.value)}
                >
                  <option value="en">English</option>
                  <option value="ta">தமிழ் (Tamil)</option>
                </select>
              </div>
            </div>

            <button type="submit" className="login-template-btn" style={{ width: '100%' }} disabled={isSubmitting}>
              {isSubmitting ? 'SAVING...' : 'COMPLETE SETUP & START'}
            </button>
          </form>
        </div>
      </div>

      <div className="login-template-right" style={{ flex: '0 0 45%', background: '#fff' }}>
        <img src={illustration} alt="Dashboard Illustration" className="login-template-illustration" />
      </div>
    </div>
  );
};

export default Onboarding;
