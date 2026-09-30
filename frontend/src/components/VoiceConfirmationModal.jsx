import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { CheckCircle2, XCircle, Mic } from 'lucide-react';

const VoiceConfirmationModal = ({ pendingTransaction, onConfirm, onCancel }) => {
  const { language, t } = useLanguage();

  if (!pendingTransaction) return null;

  const { type, amount, paymentMethod, category } = pendingTransaction;

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h2>{t('confirmVoiceTitle')}</h2>

        <div className="modal-body">
          <p className="modal-subtitle">I understood:</p>
          <div className="summary-box">
            <p><strong>{t('type')}:</strong> {type === 'Sale' ? t('sales') : t('expenses')}</p>
            <p><strong>{t('amount')}:</strong> ₹{amount}</p>
            {type === 'Sale' && <p><strong>{t('paymentSummary')}:</strong> {paymentMethod || 'Cash'}</p>}
            {type === 'Expense' && <p><strong>{t('expenseCategoryQuestion')}:</strong> {category || 'Stock'}</p>}
          </div>

          <div className="voice-confirm-hint-box" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#fef3c7',
            padding: '10px 14px',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '14px',
            fontWeight: '700',
            color: '#d97706'
          }}>
            <Mic size={18} />
            <span>
              {language === 'ta'
                ? 'சேமிக்க "ஆம்" என்றும், ரத்து செய்ய "இல்லை" என்றும் குரலில் கூறலாம்.'
                : 'Say "YES" or "CONFIRM" to save by voice, or click below.'}
            </span>
          </div>

          <p className="confirm-question">{t('isThisCorrect')}</p>
        </div>

        <div className="modal-actions">
          <button className="confirm-yes-btn" onClick={onConfirm}>
            <CheckCircle2 size={24} />
            <span>{t('yesSave')}</span>
          </button>

          <button className="confirm-no-btn" onClick={onCancel}>
            <XCircle size={24} />
            <span>{t('noCancel')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceConfirmationModal;
