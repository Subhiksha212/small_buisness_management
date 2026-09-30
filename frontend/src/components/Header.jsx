import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Volume2, Mic, Menu, LogOut, Store } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Header = ({ onToggleSidebar, onSpeakPage, onStartVoiceCommand, isListening }) => {
  const { language, setLanguage, t } = useLanguage();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
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
