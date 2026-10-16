import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ShieldCheck,
  CheckCircle,
  XCircle,
  Building2,
  Lock,
  ArrowRight,
  Info,
  Smartphone,
  Calendar,
  Layers,
} from 'lucide-react';

export default function SetuSandboxApproval() {
  const [searchParams] = useSearchParams();
  const consentId = searchParams.get('id') || searchParams.get('consentId') || `setu_sim_${Date.now()}`;
  const phone = searchParams.get('phone') || '9999999999';
  const rawRedirectUrl = searchParams.get('redirectUrl') || `${window.location.origin}/setu-callback`;

  const [otp, setOtp] = useState('123456');
  const [selectedBank, setSelectedBank] = useState('hdfc');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [otpError, setOtpError] = useState('');

  const buildRedirect = (status, extra = {}) => {
    try {
      const url = new URL(rawRedirectUrl, window.location.origin);
      url.searchParams.set('id', consentId);
      url.searchParams.set('status', status);
      if (extra.resURI) url.searchParams.set('resURI', extra.resURI);
      if (extra.errorCode) url.searchParams.set('errorCode', extra.errorCode);
      return url.toString();
    } catch {
      return `${rawRedirectUrl}?id=${encodeURIComponent(consentId)}&status=${status}`;
    }
  };

  const handleApprove = (e) => {
    e.preventDefault();
    if (otp.trim() !== '123456') {
      setOtpError('Invalid Sandbox OTP. Please enter 123456.');
      return;
    }
    setOtpError('');
    setIsSubmitting(true);

    const redirectTarget = buildRedirect('ACTIVE', {
      resURI: `http://data-session/${consentId}`,
    });

    setTimeout(() => {
      window.location.href = redirectTarget;
    }, 400);
  };

  const handleReject = () => {
    setIsSubmitting(true);
    const redirectTarget = buildRedirect('REJECTED', {
      errorCode: 'USER_ABORTED',
    });
    setTimeout(() => {
      window.location.href = redirectTarget;
    }, 300);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0f172a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: '#1e293b',
          borderRadius: '16px',
          border: '1px solid #334155',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          color: '#f8fafc',
        }}
      >
        {/* Setu Sandbox Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '800',
                fontSize: '18px',
              }}
            >
              ⚡
            </div>
            <div>
              <div style={{ fontWeight: '700', fontSize: '16px', letterSpacing: '-0.01em' }}>
                Setu Account Aggregator
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.85)' }}>
                Official RBI-Regulated Sandbox Webview
              </div>
            </div>
          </div>
          <span
            style={{
              fontSize: '10px',
              fontWeight: '700',
              padding: '4px 8px',
              borderRadius: '999px',
              backgroundColor: 'rgba(255, 255, 255, 0.25)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Sandbox Mode
          </span>
        </div>

        {/* Consent Details Body */}
        <div style={{ padding: '24px' }}>
          {/* Requesting Application */}
          <div
            style={{
              backgroundColor: '#0f172a',
              borderRadius: '10px',
              padding: '14px 16px',
              marginBottom: '20px',
              border: '1px solid #334155',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <ShieldCheck size={16} color="#38bdf8" />
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#e2e8f0' }}>
                Consent Request by Smart Business Manager
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: '1.5' }}>
              Purpose 101: Small business expense management and cashflow reconciliation. Read-only deposit history access. Passwords and PINs are never requested.
            </div>
          </div>

          {/* Consent Specifications */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
            <div style={{ backgroundColor: '#0f172a', padding: '10px 12px', borderRadius: '8px', border: '1px solid #334155' }}>
              <div style={{ fontSize: '10px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Smartphone size={12} /> Linked Phone
              </div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#f1f5f9', marginTop: '2px', fontFamily: 'monospace' }}>
                +91 {phone}
              </div>
            </div>
            <div style={{ backgroundColor: '#0f172a', padding: '10px 12px', borderRadius: '8px', border: '1px solid #334155' }}>
              <div style={{ fontSize: '10px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Calendar size={12} /> Data Range
              </div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#f1f5f9', marginTop: '2px' }}>
                Past 90 Days
              </div>
            </div>
          </div>

          {/* Bank Account Selection */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#cbd5e1', marginBottom: '8px' }}>
              Select Simulated Bank Account
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div
                onClick={() => setSelectedBank('hdfc')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: `2px solid ${selectedBank === 'hdfc' ? '#0284c7' : '#334155'}`,
                  backgroundColor: selectedBank === 'hdfc' ? 'rgba(2, 132, 199, 0.15)' : '#0f172a',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Building2 size={18} color="#38bdf8" />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600' }}>HDFC Bank - Savings</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>A/C: XXXXXXXX9988</div>
                  </div>
                </div>
                {selectedBank === 'hdfc' && <CheckCircle size={18} color="#38bdf8" />}
              </div>

              <div
                onClick={() => setSelectedBank('sbi')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: `2px solid ${selectedBank === 'sbi' ? '#0284c7' : '#334155'}`,
                  backgroundColor: selectedBank === 'sbi' ? 'rgba(2, 132, 199, 0.15)' : '#0f172a',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Building2 size={18} color="#94a3b8" />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600' }}>State Bank of India - Current</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>A/C: XXXXXXXX4321</div>
                  </div>
                </div>
                {selectedBank === 'sbi' && <CheckCircle size={18} color="#38bdf8" />}
              </div>
            </div>
          </div>

          {/* OTP Entry */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#cbd5e1' }}>
                Enter Sandbox OTP
              </label>
              <span style={{ fontSize: '11px', color: '#38bdf8' }}>Default: 123456</span>
            </div>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="123456"
              maxLength={6}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '8px',
                border: otpError ? '2px solid #ef4444' : '1px solid #475569',
                backgroundColor: '#0f172a',
                color: '#f8fafc',
                fontSize: '18px',
                letterSpacing: '6px',
                fontWeight: '700',
                textAlign: 'center',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
            {otpError && (
              <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px' }}>
                {otpError}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleReject}
              disabled={isSubmitting}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #475569',
                backgroundColor: 'transparent',
                color: '#94a3b8',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
            >
              Reject Consent
            </button>
            <button
              onClick={handleApprove}
              disabled={isSubmitting}
              style={{
                flex: 2,
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)',
              }}
            >
              {isSubmitting ? (
                'Redirecting to Callback...'
              ) : (
                <>
                  Approve Consent <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>

          {/* Footer note */}
          <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '11px', color: '#64748b' }}>
            <Lock size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
            Encrypted 256-bit Setu AA Sandbox Gateway (Consent ID: {consentId.slice(0, 16)}...)
          </div>
        </div>
      </div>
    </div>
  );
}
