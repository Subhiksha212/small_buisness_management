import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, KeyRound, Eye, EyeOff, ArrowLeft, RefreshCw, Mail } from 'lucide-react';
import { sendForgotPasswordOtpApi, verifyForgotPasswordOtpApi } from '../services/api';

const SmartBusinessLogo = () => (
  <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="fpCubeTop" x1="6" y1="4" x2="26" y2="14" gradientUnits="userSpaceOnUse">
        <stop stopColor="#F1F5F9" />
        <stop offset="1" stopColor="#93C5FD" />
      </linearGradient>
      <linearGradient id="fpCubeLeft" x1="4" y1="12" x2="16" y2="28" gradientUnits="userSpaceOnUse">
        <stop stopColor="#60A5FA" />
        <stop offset="1" stopColor="#1E40AF" />
      </linearGradient>
      <linearGradient id="fpCubeRight" x1="16" y1="12" x2="28" y2="28" gradientUnits="userSpaceOnUse">
        <stop stopColor="#334155" />
        <stop offset="1" stopColor="#0F172A" />
      </linearGradient>
    </defs>
    <path d="M16 3L27.5 9.5L16 16L4.5 9.5L16 3Z" fill="url(#fpCubeTop)" />
    <path d="M4.5 11L15 17V29.5L4.5 23.5V11Z" fill="url(#fpCubeLeft)" />
    <path d="M17 17L27.5 11V23.5L17 29.5V17Z" fill="url(#fpCubeRight)" />
    <path d="M16 16V29.5" stroke="rgba(15, 23, 42, 0.4)" strokeWidth="1" />
  </svg>
);

const ForgotPassword = () => {
  const navigate = useNavigate();

  // Steps: 'EMAIL' | 'VERIFY' | 'SUCCESS'
  const [step, setStep] = useState('EMAIL');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Resend cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  // Handle Step 1: Request 6-digit OTP
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setInfoMessage('');

    if (!email || !email.includes('@')) {
      setError('Please enter a valid registered email address.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await sendForgotPasswordOtpApi({ email });
      if (res.success) {
        setStep('VERIFY');
        setCooldown(60);
        setInfoMessage('A 6-digit code has been sent to your email.');
      } else {
        setError(res.message || 'Could not send verification code.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Server error while sending verification code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Step 2: Verify OTP & set new password
  const handleVerifyAndReset = async (e) => {
    e.preventDefault();
    setError('');

    const cleanOtp = otp.trim().replace(/\D/g, '');
    if (cleanOtp.length !== 6) {
      setError('Please enter the full 6-digit verification code.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await verifyForgotPasswordOtpApi({
        email,
        otp: cleanOtp,
        newPassword,
      });

      if (res.success) {
        setStep('SUCCESS');
      } else {
        setError(res.message || 'Verification failed.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired verification code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="smart-auth-page">
      <div className="smart-auth-card">
        {/* Brand Header */}
        <div className="smart-auth-brand">
          <SmartBusinessLogo />
          <div className="smart-auth-brand-text">
            <span className="brand-smart">SMART</span>
            <span className="brand-business">BUSINESS</span>
          </div>
        </div>

        {/* ================= STEP 1: ENTER EMAIL ================= */}
        {step === 'EMAIL' && (
          <>
            <h1 className="smart-auth-title">Reset Password</h1>
            <p className="smart-auth-subtitle">
              Enter your email address and we'll send you a 6-digit verification code
            </p>

            {error && (
              <div className="smart-auth-error">
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSendOtp} className="smart-auth-form">
              <div className="smart-auth-field">
                <label className="smart-auth-label">REGISTERED EMAIL</label>
                <div className="smart-auth-input-wrapper">
                  <input
                    type="email"
                    className="smart-auth-input"
                    placeholder="user212@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    autoComplete="email"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="smart-auth-btn"
                style={{ marginTop: '16px' }}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Sending code...' : 'Send 6-Digit Code'}
              </button>
            </form>

            <div className="smart-auth-footer">
              Remember your password?{' '}
              <Link to="/login" className="smart-auth-footer-link">
                Back to Login
              </Link>
            </div>
          </>
        )}

        {/* ================= STEP 2: ENTER OTP & NEW PASSWORD ================= */}
        {step === 'VERIFY' && (
          <>
            <h1 className="smart-auth-title">Verification Code</h1>
            <p className="smart-auth-subtitle">
              Enter the 6-digit code sent to <strong style={{ color: '#93c5fd' }}>{email}</strong>
            </p>

            {error && (
              <div className="smart-auth-error">
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {infoMessage && (
              <div className="smart-auth-info-banner">
                <Mail size={16} style={{ flexShrink: 0 }} />
                <span>{infoMessage}</span>
              </div>
            )}

            <form onSubmit={handleVerifyAndReset} className="smart-auth-form">
              {/* OTP Field */}
              <div className="smart-auth-field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="smart-auth-label" style={{ marginBottom: 0 }}>
                    6-DIGIT OTP
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('EMAIL');
                      setError('');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#60a5fa',
                      fontSize: '11px',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Change Email
                  </button>
                </div>
                <div className="smart-auth-input-wrapper">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    className="smart-auth-input smart-otp-input"
                    placeholder="••••••"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    autoFocus
                    autoComplete="one-time-code"
                  />
                </div>
              </div>

              {/* New Password */}
              <div className="smart-auth-field">
                <label className="smart-auth-label">NEW PASSWORD</label>
                <div className="smart-auth-input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="smart-auth-input has-eye"
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="smart-auth-eye-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex="-1"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="smart-auth-field">
                <label className="smart-auth-label">CONFIRM NEW PASSWORD</label>
                <div className="smart-auth-input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="smart-auth-input"
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>
              </div>

              {/* Resend OTP Link */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-10px', marginBottom: '18px' }}>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={cooldown > 0 || isSubmitting}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: cooldown > 0 ? '#64748b' : '#93c5fd',
                    fontSize: '11.5px',
                    cursor: cooldown > 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: 0,
                  }}
                >
                  <RefreshCw size={12} className={isSubmitting ? 'spin' : ''} />
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend Code'}
                </button>
              </div>

              <button type="submit" className="smart-auth-btn" disabled={isSubmitting}>
                {isSubmitting ? 'Resetting Password...' : 'Reset Password'}
              </button>
            </form>

            <div className="smart-auth-footer">
              <Link to="/login" className="smart-auth-footer-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <ArrowLeft size={14} /> Back to Login
              </Link>
            </div>
          </>
        )}

        {/* ================= STEP 3: SUCCESS ================= */}
        {step === 'SUCCESS' && (
          <div style={{ padding: '16px 0' }}>
            <div className="smart-auth-success-badge">
              <CheckCircle2 size={36} />
            </div>

            <h1 className="smart-auth-title" style={{ fontSize: '24px' }}>
              Password Reset!
            </h1>
            <p className="smart-auth-subtitle" style={{ marginBottom: '32px' }}>
              Your password has been successfully updated. You can now log in with your new credentials.
            </p>

            <button
              type="button"
              className="smart-auth-btn"
              onClick={() => navigate('/login')}
            >
              Log In Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
