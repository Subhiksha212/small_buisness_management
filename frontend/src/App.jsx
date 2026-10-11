import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';
import VoiceAssistant from './components/VoiceAssistant';
import SoundboxAlert from './components/SoundboxAlert';

import Login from './pages/Login';
import SignUp from './pages/SignUp';
import ForgotPassword from './pages/ForgotPassword';
import Onboarding from './pages/Onboarding';

import Dashboard from './pages/Dashboard';
import AddSale from './pages/AddSale';
import AddExpense from './pages/AddExpense';
import ScanBill from './pages/ScanBill';
import Transactions from './pages/History';
import ProfitLoss from './pages/ProfitLoss';
import Help from './pages/Help';
import Settings from './pages/Settings';
import UpiAppSimulator from './pages/UpiAppSimulator';

function AppContent() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speakTrigger, setSpeakTrigger] = useState(null);
  const [startListenTrigger, setStartListenTrigger] = useState(null);

  const handleSpeakPage = () => {
    if (speakTrigger) {
      speakTrigger();
    }
  };

  const handleStartVoiceCommand = () => {
    if (startListenTrigger) {
      startListenTrigger();
    } else {
      alert('Voice assistant initializing... Please try again.');
    }
  };

  return (
    <Routes>
      {/* Public Auth Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* Account Setup Onboarding Route */}
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <Onboarding />
          </ProtectedRoute>
        }
      />

      {/* Main Application Layout Routes */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <div className="app-layout">
              {/* Persistent Left Sidebar */}
              <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

              {/* Main Right Area */}
              <div className="main-wrapper">
                <Header
                  onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                  onSpeakPage={handleSpeakPage}
                  onStartVoiceCommand={handleStartVoiceCommand}
                  isListening={isListening}
                />

                <SoundboxAlert />

                <VoiceAssistant
                  isListening={isListening}
                  setIsListening={setIsListening}
                  setSpeakTrigger={setSpeakTrigger}
                  setStartListenTrigger={setStartListenTrigger}
                />

                <main className="content-area">
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/sales" element={<AddSale />} />
                    <Route path="/expenses" element={<AddExpense />} />
                    <Route path="/scan" element={<ScanBill />} />
                    <Route path="/transactions" element={<Transactions />} />
                    <Route path="/profit-loss" element={<ProfitLoss />} />
                    <Route path="/help" element={<Help />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/upi-simulator" element={<UpiAppSimulator />} />
                    <Route path="/upi-app" element={<UpiAppSimulator />} />

                    {/* Backwards compatibility redirects */}
                    <Route path="/add-sale" element={<Navigate to="/sales" replace />} />
                    <Route path="/add-expense" element={<Navigate to="/expenses" replace />} />
                    <Route path="/history" element={<Navigate to="/transactions" replace />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </main>
              </div>
            </div>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <Router>
          <AppContent />
        </Router>
      </LanguageProvider>
    </AuthProvider>
  );
}
