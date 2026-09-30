import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import illustration from '../assets/login_illustration.jpg';

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
    <div className="login-template-container">
      <div className="login-template-left">
        <div className="login-template-brand">
          Smart Business
        </div>

        <div className="login-template-form-wrapper">
          <h1>Login</h1>
          <p className="login-template-subtitle">Welcome to log in to your background management system.</p>

          {error && (
            <div className="auth-error-banner" style={{ fontSize: '12px', padding: '10px', marginBottom: '24px' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
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

            <div className="login-template-input-group">
              <label>Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                className="login-template-input"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="login-template-eye-icon"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            
            <div style={{ textAlign: 'right', marginTop: '-12px', marginBottom: '16px' }}>
              <Link to="/forgot-password" style={{ color: '#3b82f6', textDecoration: 'none', fontSize: '12px', fontWeight: 600 }}>
                Forgot Password?
              </Link>
            </div>

            <button type="submit" className="login-template-btn" disabled={isSubmitting}>
              {isSubmitting ? 'Logging in...' : 'LOGIN'}
            </button>
          </form>
          
          <div style={{ marginTop: '32px', fontSize: '12px', color: '#94a3b8' }}>
            Don't have an account? <Link to="/signup" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}>Sign up</Link>
          </div>
        </div>
      </div>

      <div className="login-template-right">
        <img src={illustration} alt="Dashboard Illustration" className="login-template-illustration" />
      </div>
    </div>
  );
};

export default Login;
