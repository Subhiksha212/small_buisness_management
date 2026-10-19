import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';

// Modern 3D isometric faceted cube logo matching the user's reference design
const SmartBusinessLogo = () => (
  <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="cubeTop" x1="6" y1="4" x2="26" y2="14" gradientUnits="userSpaceOnUse">
        <stop stopColor="#F1F5F9" />
        <stop offset="1" stopColor="#93C5FD" />
      </linearGradient>
      <linearGradient id="cubeLeft" x1="4" y1="12" x2="16" y2="28" gradientUnits="userSpaceOnUse">
        <stop stopColor="#60A5FA" />
        <stop offset="1" stopColor="#1E40AF" />
      </linearGradient>
      <linearGradient id="cubeRight" x1="16" y1="12" x2="28" y2="28" gradientUnits="userSpaceOnUse">
        <stop stopColor="#334155" />
        <stop offset="1" stopColor="#0F172A" />
      </linearGradient>
    </defs>
    {/* Top diamond facet */}
    <path d="M16 3L27.5 9.5L16 16L4.5 9.5L16 3Z" fill="url(#cubeTop)" />
    {/* Left facet */}
    <path d="M4.5 11L15 17V29.5L4.5 23.5V11Z" fill="url(#cubeLeft)" />
    {/* Right facet */}
    <path d="M17 17L27.5 11V23.5L17 29.5V17Z" fill="url(#cubeRight)" />
    {/* Subtle geometric dividing seam */}
    <path d="M16 16V29.5" stroke="rgba(15, 23, 42, 0.4)" strokeWidth="1" />
  </svg>
);

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await login({ email, password });
      if (res.success) {
        if (!res.user.isOnboarded) {
          navigate('/onboarding');
        } else {
          navigate(from, { replace: true });
        }
      } else {
        setError(res.message || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Server error during login.');
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

        {/* Title & Subtitle */}
        <h1 className="smart-auth-title">Login</h1>
        <p className="smart-auth-subtitle">
          Welcome to log in to your background management system
        </p>

        {/* Error notification banner */}
        {error && (
          <div className="smart-auth-error">
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="smart-auth-form">
          <div className="smart-auth-field">
            <label className="smart-auth-label">EMAIL</label>
            <div className="smart-auth-input-wrapper">
              <input
                type="email"
                className="smart-auth-input"
                placeholder="user212@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className="smart-auth-field">
            <label className="smart-auth-label">PASSWORD</label>
            <div className="smart-auth-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                className="smart-auth-input has-eye"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
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

          {/* Forgot Password Link */}
          <div className="smart-auth-forgot">
            <Link to="/forgot-password" className="smart-auth-forgot-link">
              Forgot Password?
            </Link>
          </div>

          {/* Login Submit Button */}
          <button type="submit" className="smart-auth-btn" disabled={isSubmitting}>
            {isSubmitting ? 'Logging in...' : 'Login'}
          </button>
        </form>

        {/* Sign up prompt footer */}
        <div className="smart-auth-footer">
          Don't have an account?{' '}
          <Link to="/signup" className="smart-auth-footer-link">
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
