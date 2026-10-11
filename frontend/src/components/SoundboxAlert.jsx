import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import useRealtimeEvents from '../hooks/useRealtimeEvents';
import {
  Volume2,
  VolumeX,
  CheckCircle2,
  X,
  ExternalLink,
  Sparkles,
  Radio,
  Zap,
} from 'lucide-react';

// Synthesize pleasant Indian UPI payment notification chime
const playSoundboxChime = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const now = ctx.currentTime;
    // Note 1 (E5 - 659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.2, now);
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
    gain2.gain.setValueAtTime(0.28, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.7);
  } catch (e) {
    // Audio context may be muted or blocked by browser policy
  }
};

// Announce payment aloud like Paytm / PhonePe Soundbox
const speakPaymentAnnouncement = (amount, provider = 'Google Pay', lang = 'en') => {
  if (!('speechSynthesis' in window)) return;

  try {
    window.speechSynthesis.cancel(); // cancel any active speech

    let text = `Payment of ${amount} rupees received on ${provider}`;
    let voiceLang = 'en-IN';

    if (lang === 'ta') {
      text = `${amount} ரூபாய் ${provider} மூலம் பெறப்பட்டது`;
      voiceLang = 'ta-IN';
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voiceLang;
    utterance.rate = 1.0;
    utterance.pitch = 1.05;

    // Try finding Indian English or Tamil voice
    const voices = window.speechSynthesis.getVoices();
    const selectedVoice = voices.find(
      (v) => v.lang.includes(lang === 'ta' ? 'ta' : 'en-IN') || v.lang.includes('en-GB')
    );
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn('Speech synthesis failed:', e);
  }
};

const SoundboxAlert = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();

  const [activeAlert, setActiveAlert] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('soundbox_sound_enabled') !== 'false';
  });

  const timerRef = useRef(null);
  const seenTransactionsRef = useRef(new Set());

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('soundbox_sound_enabled', String(next));
  };

  const handlePaymentArrival = (data) => {
    const amount = data.amount || 0;
    const provider = data.provider || data.upiApp || 'UPI';
    const utr = data.utrNumber || data.providerPaymentId || '';
    const dedupeKey = `${provider}_${utr || data.providerPaymentId || amount}`;

    // Avoid duplicate audio and popup alerts for the same transaction
    if (seenTransactionsRef.current.has(dedupeKey)) {
      return;
    }
    seenTransactionsRef.current.add(dedupeKey);

    // Play Chime
    if (soundEnabled) {
      playSoundboxChime();
      setTimeout(() => {
        speakPaymentAnnouncement(amount, provider, language);
      }, 350);
    }

    // Set Alert Card
    setActiveAlert({
      id: Date.now(),
      amount,
      provider,
      utr,
      method: data.paymentMethod || 'UPI',
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    });

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setActiveAlert(null);
    }, 8000);
  };

  useRealtimeEvents({
    onPaymentSuccess: handlePaymentArrival,
  });

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!activeAlert) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 9999,
        maxWidth: '380px',
        width: 'calc(100vw - 40px)',
        backgroundColor: '#0f172a',
        color: '#ffffff',
        borderRadius: '16px',
        boxShadow: '0 20px 40px -10px rgba(15, 23, 42, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)',
        padding: '16px',
        animation: 'slideInRight 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        overflow: 'hidden',
      }}
    >
      {/* Top Banner Strip */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              color: '#ffffff',
              boxShadow: '0 0 12px rgba(16, 185, 129, 0.5)',
            }}
          >
            <CheckCircle2 size={16} />
          </span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '700', letterSpacing: '-0.01em', color: '#f8fafc' }}>
              Real-Time Payment Received!
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>
              Smart Soundbox Announcement
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={toggleSound}
            title={soundEnabled ? 'Mute voice announcement' : 'Unmute voice announcement'}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '6px',
              color: soundEnabled ? '#38bdf8' : '#94a3b8',
              padding: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>
          <button
            type="button"
            onClick={() => setActiveAlert(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              padding: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '12px',
          padding: '12px 14px',
          marginBottom: '10px',
        }}
      >
        <div>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', fontWeight: '700' }}>
            {activeAlert.provider} • {activeAlert.method}
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#10b981', letterSpacing: '-0.02em', marginTop: '2px' }}>
            +₹{Number(activeAlert.amount).toLocaleString('en-IN')}
          </div>
          {activeAlert.utr && (
            <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '2px', fontFamily: 'monospace' }}>
              Ref/UTR: •••{activeAlert.utr.slice(-6)}
            </div>
          )}
        </div>

        <div style={{ textAlign: 'right' }}>
          <span
            style={{
              fontSize: '10px',
              fontWeight: '700',
              padding: '3px 8px',
              borderRadius: '999px',
              backgroundColor: 'rgba(16, 185, 129, 0.2)',
              color: '#34d399',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'inline-block',
              marginBottom: '6px',
            }}
          >
            Captured Live
          </span>
          <div style={{ fontSize: '10px', color: '#64748b' }}>{activeAlert.timestamp}</div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          type="button"
          onClick={() => {
            setActiveAlert(null);
            navigate('/transactions');
          }}
          style={{
            flex: 1,
            backgroundColor: '#10b981',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            padding: '7px 12px',
            fontSize: '11px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
          }}
        >
          <span>View in Ledger</span>
          <ExternalLink size={12} />
        </button>
        <button
          type="button"
          onClick={() => setActiveAlert(null)}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            color: '#e2e8f0',
            border: 'none',
            borderRadius: '8px',
            padding: '7px 12px',
            fontSize: '11px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          Dismiss
        </button>
      </div>

      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default SoundboxAlert;
