import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  ShoppingCart,
  MinusCircle,
  ReceiptText,
  PieChart,
  HelpCircle,
  Settings,
  Store,
  Utensils,
  User,
  LogOut,
  X,
  ChevronLeft,
  QrCode,
} from 'lucide-react';

const Sidebar = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getAccountBadge = () => {
    switch (user?.accountType) {
      case 'restaurant':
        return { label: 'Restaurant', icon: Utensils, bg: 'rgba(234,88,12,0.18)', color: '#fb923c' };
      case 'personal':
        return { label: 'Personal', icon: User, bg: 'rgba(22,163,74,0.18)', color: '#4ade80' };
      case 'retail':
      default:
        return { label: 'Retail Store', icon: Store, bg: 'rgba(37,99,235,0.18)', color: '#93c5fd' };
    }
  };

  const badge = getAccountBadge();
  const BadgeIcon = badge.icon;

  const navItems = [
    { to: '/', labelKey: 'navDashboard', icon: LayoutDashboard },
    { to: '/add-sale', labelKey: 'navAddSale', icon: ShoppingCart },
    { to: '/scan', labelKey: 'navScanBill', icon: QrCode },
    { to: '/expenses', labelKey: 'navExpenses', icon: MinusCircle },
    { to: '/transactions', labelKey: 'navTransactions', icon: ReceiptText },
    { to: '/profit-loss', labelKey: 'navProfitLoss', icon: PieChart },
    { to: '/help', labelKey: 'navVoiceHelp', icon: HelpCircle },
    { to: '/settings', labelKey: 'navSettings', icon: Settings },
  ];


  return (
    <>
      {/* Mobile overlay backdrop */}
      {isOpen && <div className="sidebar-backdrop" onClick={onClose} />}

      <aside className={`app-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <Store size={22} className="brand-icon" />
            <div className="brand-titles">
              <span className="brand-name">Smart Business</span>
              {user && (
                <span className="user-business-display">
                  {user.businessName || user.name}
                </span>
              )}
            </div>
          </div>
          <button
            className="sidebar-close-btn"
            onClick={onClose}
            title="Close Sidebar"
            aria-label="Close Sidebar"
          >
            <ChevronLeft size={18} />
          </button>
        </div>

        {user && (
          <div className="sidebar-account-badge" style={{ backgroundColor: badge.bg }}>
            <BadgeIcon size={14} color={badge.color} />
            <span style={{ color: badge.color, fontWeight: 700, fontSize: '11px' }}>
              {badge.label}
            </span>
          </div>
        )}

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
                onClick={onClose}
              >
                <Icon size={17} className="sidebar-item-icon" />
                <span>{t(item.labelKey)}</span>
              </NavLink>
            );
          })}
        </nav>

        {user && (
          <div className="sidebar-user-footer">
            <div className="user-info-text">
              <span className="user-name-label">{user.name}</span>
              <span className="user-email-label">{user.email}</span>
            </div>
            <button className="logout-sidebar-btn" onClick={handleLogout} title="Log Out">
              <LogOut size={16} />
            </button>
          </div>
        )}
      </aside>
    </>
  );
};

export default Sidebar;
