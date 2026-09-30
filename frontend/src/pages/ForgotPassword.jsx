import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import illustration from '../assets/login_illustration.jpg';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!email) {
      setError('Please enter your email address.');
      return;
    }

    try {
      setIsSubmitting(true);
      // Simulate API call for password reset
      await new Promise(resolve => setTimeout(resolve, 1500));
      setSuccess(true);
      setEmail('');
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-template-container">
      <div className="login-template-left">
        <div className="login-template-brand">
          Smart Business
        </div>

        <div className="login-template-form-wrapper">
          <h1>Reset Password</h1>
          <p className="login-template-subtitle">Enter your email address and we'll send you instructions to reset your password.</p>

          {error && (
            <div className="auth-error-banner" style={{ fontSize: '12px', padding: '10px', marginBottom: '24px' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
          
          {success && (
            <div className="auth-error-banner" style={{ fontSize: '12px', padding: '10px', marginBottom: '24px', backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', color: '#16a34a' }}>
              <span>Reset instructions sent! Check your inbox.</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="login-template-input-group">
              <label>Email</label>
              <input
                type="email"
                className="login-template-input"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="login-template-btn" disabled={isSubmitting}>
              {isSubmitting ? 'SENDING...' : 'RESET PASSWORD'}
            </button>
          </form>
          
          <div style={{ marginTop: '32px', fontSize: '12px', color: '#94a3b8' }}>
            Remember your password? <Link to="/login" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}>Back to Login</Link>
          </div>
        </div>
      </div>

      <div className="login-template-right">
        <img src={illustration} alt="Dashboard Illustration" className="login-template-illustration" />
      </div>
    </div>
  );
};

export default ForgotPassword;
