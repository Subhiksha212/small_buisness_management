import React, { createContext, useState, useContext } from 'react';
import { translations } from '../translations';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState('en'); // 'en' or 'ta'

  const t = (key, replacements = {}) => {
    const langDict = translations[language] || translations.en;
    let text = langDict[key] || translations.en[key] || key;

    // Handle string format replacements e.g. {sales}
    Object.keys(replacements).forEach((param) => {
      text = text.replace(`{${param}}`, replacements[param]);
    });

    return text;
  };

  const speakText = (textKey, replacements = {}) => {
    if (!('speechSynthesis' in window)) {
      alert('Speech synthesis is not supported in your browser.');
      return;
    }

    window.speechSynthesis.cancel(); // Cancel any ongoing speech
    const textToSpeak = typeof textKey === 'string' && translations[language]?.[textKey] 
      ? t(textKey, replacements)
      : textKey;

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = language === 'ta' ? 'ta-IN' : 'en-US';
    utterance.rate = 0.9; // Slightly slower speech for clarity

    window.speechSynthesis.speak(utterance);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, speakText }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
