import React from 'react';
import { NavLink } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { Home, PlusCircle, MinusCircle, History, HelpCircle } from 'lucide-react';

const Navbar = () => {
  const { t } = useLanguage();

  return (
    <nav className="app-navbar">
      <div className="navbar-container">
        <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Home size={24} />
          <span>{t('home')}</span>
        </NavLink>

        <NavLink to="/add-sale" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <PlusCircle size={24} />
          <span>{t('addSale')}</span>
        </NavLink>

        <NavLink to="/add-expense" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <MinusCircle size={24} />
          <span>{t('addExpense')}</span>
        </NavLink>

        <NavLink to="/history" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <History size={24} />
          <span>{t('history')}</span>
        </NavLink>

        <NavLink to="/help" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <HelpCircle size={24} />
          <span>{t('help')}</span>
        </NavLink>
      </div>
    </nav>
  );
};

export default Navbar;
