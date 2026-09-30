import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import VoiceConfirmationModal from './VoiceConfirmationModal';
import { createSale, createExpense } from '../services/api';

const VoiceAssistant = ({ isListening, setIsListening, setSpeakTrigger, setStartListenTrigger }) => {
  const { language, t, speakText } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const [pendingTx, setPendingTx] = useState(null);

  // Helper to read current page aloud in selected language (en / ta)
  const handleReadPage = () => {
    const path = location.pathname;

    if (path === '/') {
      speakText('voiceExplanationDashboard');
    } else if (path === '/sales') {
      speakText('voiceExplanationSales');
    } else if (path === '/expenses') {
      speakText('voiceExplanationExpenses');
    } else if (path === '/scan') {
      speakText('voiceExplanationScan');
    } else if (path === '/transactions') {
      speakText('voiceExplanationTransactions');
    } else if (path === '/profit-loss') {
      speakText('voiceExplanationProfitLoss');
    } else if (path === '/help') {
      speakText('voiceExplanationHelp');
    }
  };

  // Multilingual Speech Recognition
  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech Recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = language === 'ta' ? 'ta-IN' : 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      console.log(`Voice Command Received (${language}):`, transcript);
      parseCommand(transcript);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  useEffect(() => {
    if (setSpeakTrigger) {
      setSpeakTrigger(() => handleReadPage);
    }
    if (setStartListenTrigger) {
      setStartListenTrigger(() => startListening);
    }
  }, [location.pathname, language]);

  // Handle Spoken Confirmations when Pending Confirmation Modal is Active
  const handleSpokenConfirmation = (lowerText) => {
    const yesKeywords = [
      'yes', 'confirm', 'save', 'correct', 'ok', 'okay', 'yeah', 'yep', 'sure', 'add',
      'ஆம்', 'சரி', 'சேமி', 'உறுதி', 'சேர்'
    ];

    const noKeywords = [
      'no', 'cancel', 'stop', 'close', 'dont', "don't", 'reject',
      'இல்லை', 'ரத்து', 'வேண்டாம்'
    ];

    if (yesKeywords.some((kw) => lowerText.includes(kw))) {
      handleConfirmTransaction();
      return true;
    }

    if (noKeywords.some((kw) => lowerText.includes(kw))) {
      handleCancelTransaction();
      return true;
    }

    return false;
  };

  // Multilingual Voice Command & Amount Parser
  const parseCommand = (text) => {
    const lower = text.toLowerCase();

    // 0. IF CONFIRMATION MODAL IS ACTIVE: Check spoken "YES" / "NO" response
    if (pendingTx) {
      const handled = handleSpokenConfirmation(lower);
      if (handled) return;
    }

    const currentPath = location.pathname;

    // 1. FIRST: Check if the spoken text contains a numeric amount!
    const numbers = lower.match(/\d+/g);
    const amount = numbers ? parseInt(numbers[0], 10) : null;

    if (amount && amount > 0) {
      // Check if it's explicitly an Expense
      const isExpense =
        currentPath === '/expenses' ||
        lower.includes('spent') ||
        lower.includes('expense') ||
        lower.includes('remove') ||
        lower.includes('delete') ||
        lower.includes('minus') ||
        lower.includes('deduct') ||
        lower.includes('took') ||
        lower.includes('reduce') ||
        lower.includes('paid') ||
        lower.includes('pay') ||
        lower.includes('given') ||
        lower.includes('selavu') ||
        lower.includes('செலவு') ||
        lower.includes('நீக்கு') ||
        lower.includes('கழி') ||
        lower.includes('கொடுத்தேன்') ||
        lower.includes('rent') ||
        lower.includes('வாடகை') ||
        lower.includes('electricity') ||
        lower.includes('current') ||
        lower.includes('மின்சாரம்') ||
        lower.includes('salary') ||
        lower.includes('சம்பளம்') ||
        lower.includes('transport') ||
        lower.includes('போக்குவரத்து') ||
        lower.includes('stock');

      if (isExpense) {
        let category = 'Stock';
        if (lower.includes('rent') || lower.includes('வாடகை')) category = 'Rent';
        if (lower.includes('electricity') || lower.includes('current') || lower.includes('மின்சாரம்')) category = 'Electricity';
        if (lower.includes('salary') || lower.includes('staff') || lower.includes('சம்பளம்')) category = 'Salary';
        if (lower.includes('transport') || lower.includes('போக்குவரத்து')) category = 'Transport';

        const newTx = {
          type: 'Expense',
          amount,
          category,
          paymentMethod: 'Cash',
          description: language === 'ta' ? 'குரல் செலவு பதிவு' : 'Voice Expense',
        };
        setPendingTx(newTx);
        return;
      } else {
        // Spoken sales are ALWAYS recorded as Cash sales manually
        const newTx = {
          type: 'Sale',
          amount,
          paymentMethod: 'Cash',
          description: language === 'ta' ? 'குரல் ரொக்க விற்பனை' : 'Voice Cash Sale',
        };
        setPendingTx(newTx);
        return;
      }
    }

    // 2. SECOND: Pure Navigation Commands (no numbers spoken)
    if (
      lower.includes('open dashboard') ||
      lower.includes('dashboard') ||
      lower.includes('home') ||
      lower.includes('முகப்பு') ||
      lower.includes('டேஷ்போர்டு')
    ) {
      navigate('/');
      return;
    }

    if (
      lower.includes('add cash sale') ||
      lower.includes('add sale') ||
      lower.includes('open sale') ||
      lower.includes('sales') ||
      lower.includes('விற்பனை')
    ) {
      navigate('/sales');
      return;
    }

    if (
      lower.includes('show upi payments') ||
      lower.includes('show card payments') ||
      lower.includes('upi payments') ||
      lower.includes('card payments')
    ) {
      navigate('/sales');
      return;
    }

    if (
      lower.includes('add expense') ||
      lower.includes('open expense') ||
      lower.includes('expenses') ||
      lower.includes('செலவு')
    ) {
      navigate('/expenses');
      return;
    }

    if (
      lower.includes('scan bill') ||
      lower.includes('scan expense bill') ||
      lower.includes('scan') ||
      lower.includes('பில் ஸ்கேன்')
    ) {
      navigate('/scan');
      return;
    }

    if (
      lower.includes('show transactions') ||
      lower.includes('transactions') ||
      lower.includes('history') ||
      lower.includes('வரலாறு')
    ) {
      navigate('/transactions');
      return;
    }

    if (
      lower.includes('show profit') ||
      lower.includes('show today\'s profit') ||
      lower.includes('show monthly profit') ||
      lower.includes('profit') ||
      lower.includes('லாபம்')
    ) {
      navigate('/profit-loss');
      return;
    }

    const errorMsg = language === 'ta'
      ? `குரல் கட்டளை: "${text}" புரியவில்லை.`
      : `Voice Command: "${text}" not recognized. Try saying "Add cash sale", "Show UPI payments", "Scan expense bill", or "Show profit".`;

    alert(errorMsg);
  };

  const handleConfirmTransaction = async () => {
    if (!pendingTx) return;

    try {
      if (pendingTx.type === 'Sale') {
        // Enforce Cash Sale for voice entry
        await createSale({
          amount: pendingTx.amount,
          paymentMethod: 'Cash',
          description: pendingTx.description,
          entryMethod: 'manual',
        });
      } else {
        await createExpense({
          amount: pendingTx.amount,
          category: pendingTx.category || 'Stock',
          paymentMethod: 'Cash',
          description: pendingTx.description,
          entryMethod: 'manual',
        });
      }
      setPendingTx(null);
      navigate('/transactions');
    } catch (err) {
      alert('Failed to save voice transaction.');
    }
  };

  const handleCancelTransaction = () => {
    setPendingTx(null);
  };

  return (
    <VoiceConfirmationModal
      pendingTransaction={pendingTx}
      onConfirm={handleConfirmTransaction}
      onCancel={handleCancelTransaction}
    />
  );
};

export default VoiceAssistant;
