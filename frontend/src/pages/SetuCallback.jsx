import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { verifySetuCallback, getSetuConfig } from '../services/api';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  Info,
  Copy,
  Check,
  ExternalLink,
  Lock,
  Building2,
} from 'lucide-react';

export default function SetuCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t, language } = useLanguage();

  // 1. Read and preserve all query parameters from Setu AA redirect
  const consentId = searchParams.get('id') || searchParams.get('consentId') || searchParams.get('consent-handle') || '';
  const claimedStatus = searchParams.get('status') || '';
  const errorCode = searchParams.get('errorCode') || searchParams.get('error') || '';
  const errorMessage = searchParams.get('errorMessage') || searchParams.get('errorMsg') || '';
  const resURI = searchParams.get('resURI') || '';
  const txnid = searchParams.get('txnid') || '';

  // Copy-to-clipboard state
  const [copied, setCopied] = useState(false);

  // Verification state (Pending -> Success | Rejection | Error | Unconfigured)
  const [verificationState, setVerificationState] = useState('verifying'); // 'verifying' | 'active' | 'rejected' | 'failed' | 'unconfigured'
  const [verificationDetails, setVerificationDetails] = useState(null);
  const [serverError, setServerError] = useState('');
  const [configInfo, setConfigInfo] = useState(null);

  const handleCopyParams = () => {
    const rawData = JSON.stringify(Object.fromEntries([...searchParams]), null, 2);
    navigator.clipboard.writeText(rawData);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    let isMounted = true;

    async function verifyWithBackend() {
      // If user clearly cancelled / aborted during the Setu journey
      if (errorCode || claimedStatus === 'REJECTED' || claimedStatus === 'FAILED') {
        if (isMounted) {
          setVerificationState('rejected');
          setVerificationDetails({
            status: 'REJECTED',
            reason: errorMessage || errorCode || 'Consent flow was cancelled or declined by user.',
          });
        }
        return;
      }

      // If no consent ID was returned in the URL
      if (!consentId) {
        if (isMounted) {
          setVerificationState('failed');
          setServerError('No Consent ID found in the redirect parameters.');
        }
        return;
      }

      try {
        setVerificationState('verifying');

        // Check backend config first
        const configRes = await getSetuConfig().catch(() => null);
        if (isMounted && configRes?.config) {
          setConfigInfo(configRes.config);
        }

        // Authoritatively verify with backend & Setu AA Gateway
        const verifyRes = await verifySetuCallback({
          id: consentId,
          consentId,
          status: claimedStatus,
          errorCode,
          errorMessage,
          resURI,
          txnid,
        });

        if (!isMounted) return;

        const result = verifyRes.verification;
        setVerificationDetails(result);

        if (!result.configured) {
          setVerificationState('unconfigured');
        } else if (result.status === 'ACTIVE' && result.isVerified) {
          setVerificationState('active');
        } else if (result.status === 'REJECTED') {
          setVerificationState('rejected');
        } else {
          setVerificationState('failed');
        }
      } catch (err) {
        if (!isMounted) return;
        console.error('Setu callback verification failed:', err);

        // If backend returned unconfigured status code 503
        if (err.response?.status === 503 || err.response?.data?.configured === false) {
          setVerificationState('unconfigured');
          setServerError(err.response?.data?.message || 'Setu AA credentials are not yet configured on the backend.');
        } else {
          setVerificationState('failed');
          setServerError(err.response?.data?.message || err.message || 'Unable to communicate with verification service.');
        }
      }
    }

    verifyWithBackend();

    return () => {
      isMounted = false;
    };
  }, [consentId, claimedStatus, errorCode, errorMessage, resURI, txnid]);

  return (
    <div className="section-page-container" style={{ maxWidth: '840px', margin: '0 auto', padding: '24px 16px' }}>
      {/* Intro Header */}
      <div className="page-intro-bar" style={{ marginBottom: '20px' }}>
        <div>
          <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={24} color="#0284c7" />
            Setu Account Aggregator Consent Callback
          </h2>
          <p className="section-subtitle">
            Secure redirect verification for RBI-regulated Account Aggregator consent flows (Stage 1 Sandbox)
          </p>
        </div>
      </div>

      {/* Main Status Card */}
      <div className="sleek-panel" style={{ padding: '24px', borderRadius: '14px', marginBottom: '20px' }}>
        {/* STATE 1: VERIFYING */}
        {verificationState === 'verifying' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <RefreshCw size={36} color="#0284c7" className="spin" style={{ margin: '0 auto 16px auto' }} />
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: '0 0 8px 0' }}>
              Verifying Consent with Setu AA Gateway...
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '520px', margin: '0 auto' }}>
              Query parameters were received. Confirming authoritative consent status with Setu API to prevent unverified client tampering.
            </p>
          </div>
        )}

        {/* STATE 2: ACTIVE & VERIFIED */}
        {verificationState === 'active' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={24} color="#10b981" />
              </div>
              <div>
                <span className="status-micro-pill pill-profit" style={{ fontSize: '11px', marginBottom: '4px', display: 'inline-block' }}>
                  ● UPSTREAM VERIFIED ACTIVE
                </span>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#065f46', margin: 0 }}>
                  Account Aggregator Consent Approved
                </h3>
              </div>
            </div>
            <p style={{ fontSize: '13px', color: '#047857', lineHeight: '1.5', margin: '0 0 16px 0' }}>
              The consent artifact has been verified directly against the Setu FIU Sandbox API. Your linked accounts are active under the consent mandate.
            </p>
            <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '10px', padding: '12px 16px', fontSize: '12px', color: '#065f46' }}>
              <strong>Stage 1 Notice:</strong> In this foundation stage, consent verification is active. Automatic transaction ingestion and data flow sessions will be activated in subsequent stages after sandbox testing.
            </div>
          </div>
        )}

        {/* STATE 3: USER REJECTED / CANCELLED */}
        {verificationState === 'rejected' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <XCircle size={24} color="#ef4444" />
              </div>
              <div>
                <span className="status-micro-pill pill-rose" style={{ fontSize: '11px', marginBottom: '4px', display: 'inline-block' }}>
                  ● CONSENT REJECTED / CANCELLED
                </span>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#991b1b', margin: 0 }}>
                  Consent Journey Incomplete
                </h3>
              </div>
            </div>
            <p style={{ fontSize: '13px', color: '#7f1d1d', lineHeight: '1.5', margin: '0 0 16px 0' }}>
              The Account Aggregator consent was rejected by the user or cancelled prior to completion. No banking data was linked or accessed.
            </p>
            {errorCode && (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '10px', padding: '10px 14px', fontSize: '12px', color: '#991b1b' }}>
                <strong>Reason / Error Code:</strong> <code>{errorCode}</code> {errorMessage ? `— ${errorMessage}` : ''}
              </div>
            )}
          </div>
        )}

        {/* STATE 4: UNCONFIGURED (MISSING SETU CREDENTIALS) */}
        {verificationState === 'unconfigured' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={24} color="#f59e0b" />
              </div>
              <div>
                <span className="status-micro-pill pill-amber" style={{ fontSize: '11px', marginBottom: '4px', display: 'inline-block' }}>
                  ⚡ BACKEND SETU CREDENTIALS REQUIRED
                </span>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#92400e', margin: 0 }}>
                  Redirect Captured (Backend Pending Configuration)
                </h3>
              </div>
            </div>
            <p style={{ fontSize: '13px', color: '#78350f', lineHeight: '1.5', margin: '0 0 16px 0' }}>
              The redirect parameters were safely extracted and captured. However, upstream verification against Setu FIU Sandbox requires configuring <code>SETU_CLIENT_ID</code>, <code>SETU_CLIENT_SECRET</code>, and <code>SETU_PRODUCT_INSTANCE_ID</code> in <code>backend/.env</code>.
            </p>
            <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '10px', padding: '12px 14px', fontSize: '12px', color: '#78350f' }}>
              <strong>Next Step for College Project:</strong> Add your Setu Developer Sandbox credentials to <code>backend/.env</code>, then refresh this page to complete authoritative upstream verification.
            </div>
          </div>
        )}

        {/* STATE 5: VERIFICATION FAILED */}
        {verificationState === 'failed' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <XCircle size={24} color="#ef4444" />
              </div>
              <div>
                <span className="status-micro-pill pill-rose" style={{ fontSize: '11px', marginBottom: '4px', display: 'inline-block' }}>
                  ● VERIFICATION FAILED
                </span>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#991b1b', margin: 0 }}>
                  Unable to Verify Consent Status
                </h3>
              </div>
            </div>
            <p style={{ fontSize: '13px', color: '#7f1d1d', lineHeight: '1.5', margin: '0 0 14px 0' }}>
              {serverError || 'The consent status could not be verified with Setu AA Gateway. Unverified consent is rejected for safety.'}
            </p>
          </div>
        )}
      </div>

      {/* EXTRACTED PARAMETERS TABLE (NEVER DISCARDED) */}
      <div className="sleek-panel" style={{ padding: '20px', borderRadius: '14px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Info size={16} color="#0284c7" />
            <h4 style={{ fontSize: '14px', fontWeight: '700', margin: 0, color: '#0f172a' }}>
              Preserved Setu Query Parameters
            </h4>
          </div>
          <button
            type="button"
            onClick={handleCopyParams}
            className="sleek-btn-secondary"
            style={{ fontSize: '11px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy JSON'}</span>
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
          <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', display: 'block' }}>Consent ID / Handle:</span>
            <code style={{ fontSize: '12px', color: '#0f172a', wordBreak: 'break-all' }}>{consentId || 'None returned'}</code>
          </div>

          <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', display: 'block' }}>Claimed Status (Redirect):</span>
            <code style={{ fontSize: '12px', color: '#0f172a' }}>{claimedStatus || 'None'}</code>
          </div>

          {errorCode && (
            <div style={{ background: '#fef2f2', padding: '10px 12px', borderRadius: '8px', border: '1px solid #fecaca' }}>
              <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: '600', display: 'block' }}>Error Code:</span>
              <code style={{ fontSize: '12px', color: '#991b1b' }}>{errorCode}</code>
            </div>
          )}

          {errorMessage && (
            <div style={{ background: '#fef2f2', padding: '10px 12px', borderRadius: '8px', border: '1px solid #fecaca' }}>
              <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: '600', display: 'block' }}>Error Message:</span>
              <span style={{ fontSize: '12px', color: '#991b1b' }}>{errorMessage}</span>
            </div>
          )}

          {resURI && (
            <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', display: 'block' }}>Resource URI:</span>
              <code style={{ fontSize: '12px', color: '#0f172a', wordBreak: 'break-all' }}>{resURI}</code>
            </div>
          )}
        </div>
      </div>

      {/* Security & Action Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b' }}>
          <Lock size={14} color="#64748b" />
          <span>Stage 1 Sandbox Environment &bull; No passwords or PINs stored</span>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Link to="/settings" className="sleek-btn-secondary" style={{ textDecoration: 'none', fontSize: '13px' }}>
            Payment Settings
          </Link>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="sleek-btn-primary btn-cyan"
            style={{ fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <span>Return to Dashboard</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
