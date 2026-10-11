import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Volume2, Mic, Menu, LogOut, Store, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { syncGatewayPayments } from '../services/api';

const Header = ({ onToggleSidebar, onSpeakPage, onStartVoiceCommand, isListening }) => {
  const { language, setLanguage, t } = useLanguage();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isSyncing, setIsSyncing] = React.useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSyncPayments = async () => {
    setIsSyncing(true);
    try {
      const res = await syncGatewayPayments();
      if (res.newlySynced > 0) {
        alert(`Fetched ${res.newlySynced} new payment(s) from Razorpay!`);
      }
    } catch (e) {
      console.warn('Sync failed:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <header className="app-header-sleek">
      <div className="header-left-sleek">
        <button className="mobile-menu-btn" onClick={onToggleSidebar}>
          <Menu size={20} />
        </button>
        <div className="header-brand-wrap">
          <h1 className="header-title-text">{t('appTitle')}</h1>
          {user?.businessName && (
            <span className="header-chip-business">{user.businessName}</span>
          )}
        </div>
      </div>

      <div className="header-right-sleek">
        {/* Language Selector */}
        <div className="lang-switcher-glass">
          <button
            className={`lang-choice-btn ${language === 'en' ? 'active' : ''}`}
            onClick={() => setLanguage('en')}
          >
            EN
          </button>
          <span className="lang-sep">|</span>
          <button
            className={`lang-choice-btn ${language === 'ta' ? 'active' : ''}`}
            onClick={() => setLanguage('ta')}
          >
            தமிழ்
          </button>
        </div>

        {/* Real-time Gateway Sync Button */}
        <button
          className="glass-header-btn"
          onClick={handleSyncPayments}
          disabled={isSyncing}
          title="Fetch latest payments directly from Razorpay"
          style={{ gap: '6px' }}
        >
          <RefreshCw size={13} className={isSyncing ? 'spin' : ''} />
          <span>{isSyncing ? 'Fetching...' : 'Sync Gateway'}</span>
        </button>

        {/* Read Page Button */}
        <button className="glass-header-btn btn-voice-read" onClick={onSpeakPage} title="Read current page aloud">
          <Volume2 size={15} />
          <span>{t('voiceHelp')}</span>
        </button>

        {/* Voice Command Button */}
        <button
          className={`glass-header-btn btn-voice-mic ${isListening ? 'listening' : ''}`}
          onClick={onStartVoiceCommand}
          title="Speak a voice command"
        >
          <Mic size={15} />
          <span>{isListening ? t('micActive') : t('speakBtn')}</span>
        </button>

        {/* Logout Quick Button */}
        {user && (
          <button
            className="glass-header-btn btn-logout-icon"
            onClick={handleLogout}
            title="Log Out"
          >
            <LogOut size={15} />
          </button>
        )}
      </div>
    </header>
  );
};

export default Header;
