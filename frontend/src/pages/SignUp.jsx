import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import illustration from '../assets/login_illustration.jpg';

const SignUp = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name || !email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await register({ name, email, password });
      if (res.success) {
        navigate('/onboarding');
      } else {
        setError(res.message || 'Registration failed.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Server error during registration.');
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
          <h1>Sign Up</h1>
          <p className="login-template-subtitle">Create your account to start managing your business.</p>

          {error && (
            <div className="auth-error-banner" style={{ fontSize: '12px', padding: '10px', marginBottom: '24px' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="login-template-input-group">
              <label>Full Name / Business Name</label>
              <input
                type="text"
                className="login-template-input"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

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
                placeholder="At least 6 characters"
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

            <button type="submit" className="login-template-btn" disabled={isSubmitting}>
              {isSubmitting ? 'CREATING...' : 'SIGN UP'}
            </button>
          </form>
          
          <div style={{ marginTop: '32px', fontSize: '12px', color: '#94a3b8' }}>
            Already have an account? <Link to="/login" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}>Log In</Link>
          </div>
        </div>
      </div>

      <div className="login-template-right">
        <img src={illustration} alt="Dashboard Illustration" className="login-template-illustration" />
      </div>
    </div>
  );
};

export default SignUp;
