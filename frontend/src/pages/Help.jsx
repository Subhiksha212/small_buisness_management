import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import {
  Volume2,
  Mic,
  PlusCircle,
  MinusCircle,
  HelpCircle,
  Sparkles,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';

const Help = () => {
  const { t, speakText } = useLanguage();

  const handleSpeakDemo = (text) => {
    speakText(text);
  };

  return (
    <div className="section-page-container">
      {/* Page Title & Breadcrumb */}
      <div className="page-intro-bar">
        <div>
          <h2 className="section-title">{t('navVoiceHelp') || 'Help & Voice Guide'}</h2>
          <p className="section-subtitle">Hands-free voice accounting and step-by-step cashier cheat-sheets</p>
        </div>
      </div>

      <div className="help-grid-2col">
        {/* Voice Features */}
        <div className="sleek-panel">
          <div className="panel-header-compact">
            <div className="flex-align-gap">
              <span className="icon-badge-round badge-cyan">
                <Volume2 size={16} />
              </span>
              <div>
                <h3 className="panel-heading">1. Read Page Aloud (Voice Help)</h3>
                <span className="panel-subheading">Multilingual audible guidance</span>
              </div>
            </div>
          </div>
          <p className="help-desc-text">
            Tap the speaker button <strong>Voice Help</strong> in the navigation header. The system will articulate current metrics and available actions in your selected language (English or Tamil).
          </p>
          <button
            className="sleek-btn-primary btn-cyan mt-12"
            onClick={() => handleSpeakDemo('voiceExplanationHelp')}
          >
            <Volume2 size={14} />
            <span>Test Audio Voice Output</span>
          </button>
        </div>

        {/* Voice Commands */}
        <div className="sleek-panel">
          <div className="panel-header-compact">
            <div className="flex-align-gap">
              <span className="icon-badge-round badge-purple">
                <Mic size={16} />
              </span>
              <div>
                <h3 className="panel-heading">2. Hands-Free Voice Commands</h3>
                <span className="panel-subheading">Automated navigation & transcription</span>
              </div>
            </div>
          </div>
          <p className="help-desc-text">Tap <strong>Speak</strong> and speak naturally:</p>
          <div className="commands-compact-list">
            <div className="command-chip"><em>"Add sale"</em> → Opens Record Sale</div>
            <div className="command-chip"><em>"Add expense"</em> → Opens Record Expense</div>
            <div className="command-chip"><em>"Show history"</em> → Opens Transactions</div>
            <div className="command-chip"><em>"I sold 500 rupees"</em> → Auto-fills ₹500 Sale</div>
            <div className="command-chip"><em>"Spent 1000 on stock"</em> → Auto-fills ₹1,000 Expense</div>
          </div>
        </div>

        {/* Step-by-Step Sale */}
        <div className="sleek-panel">
          <div className="panel-header-compact">
            <div className="flex-align-gap">
              <span className="icon-badge-round badge-profit">
                <PlusCircle size={16} />
              </span>
              <div>
                <h3 className="panel-heading">3. How to Record a Sale</h3>
                <span className="panel-subheading">Cash & digital counter sales</span>
              </div>
            </div>
          </div>
          <ol className="compact-step-list">
            <li>Click <strong>Record Sale</strong> in the top navigation or dashboard.</li>
            <li>Type or tap quick add chips (+₹100, +₹500) for the sale total.</li>
            <li>Optional: Add item note (e.g. <em>2 shirts, rice bag</em>).</li>
            <li>Click <strong>Record Cash Sale</strong>. It immediately updates P&L and Balance!</li>
          </ol>
        </div>

        {/* Step-by-Step Expense */}
        <div className="sleek-panel">
          <div className="panel-header-compact">
            <div className="flex-align-gap">
              <span className="icon-badge-round badge-loss">
                <MinusCircle size={16} />
              </span>
              <div>
                <h3 className="panel-heading">4. How to Record an Expense</h3>
                <span className="panel-subheading">Operational bills & inventory</span>
              </div>
            </div>
          </div>
          <ol className="compact-step-list">
            <li>Click <strong>Record Expense</strong> or <strong>Smart Scan</strong>.</li>
            <li>Input the amount spent.</li>
            <li>Select category (Stock, Rent, Electricity, Salary, Transport).</li>
            <li>Click <strong>Record Expense</strong> to register the outlay.</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default Help;
