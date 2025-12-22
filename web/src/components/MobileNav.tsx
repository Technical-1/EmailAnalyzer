import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Menu,
  X,
  Upload,
  Mail,
  Users,
  CreditCard,
  Calendar,
  Settings,
  BarChart3,
  UserCircle,
  Tag,
  RefreshCw,
  Newspaper,
  Paperclip,
  Shield,
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

interface NavItem {
  path: string;
  icon: React.ReactNode;
  label: string;
}

const navItems: NavItem[] = [
  { path: '/', icon: <Upload className="w-5 h-5" />, label: 'Upload' },
  { path: '/emails', icon: <Mail className="w-5 h-5" />, label: 'Emails' },
  { path: '/senders', icon: <UserCircle className="w-5 h-5" />, label: 'Senders' },
  { path: '/accounts', icon: <Tag className="w-5 h-5" />, label: 'Accounts' },
  { path: '/purchases', icon: <CreditCard className="w-5 h-5" />, label: 'Purchases' },
  { path: '/subscriptions', icon: <RefreshCw className="w-5 h-5" />, label: 'Subscriptions' },
  { path: '/newsletters', icon: <Newspaper className="w-5 h-5" />, label: 'Newsletters' },
  { path: '/attachments', icon: <Paperclip className="w-5 h-5" />, label: 'Attachments' },
  { path: '/contacts', icon: <Users className="w-5 h-5" />, label: 'Contacts' },
  { path: '/calendar', icon: <Calendar className="w-5 h-5" />, label: 'Calendar' },
  { path: '/analytics', icon: <BarChart3 className="w-5 h-5" />, label: 'Analytics' },
  { path: '/backup', icon: <Shield className="w-5 h-5" />, label: 'Backup' },
  { path: '/settings', icon: <Settings className="w-5 h-5" />, label: 'Settings' },
];

export const MobileNav: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle menu"
            >
              {isOpen ? (
                <X className="w-6 h-6 text-slate-600 dark:text-slate-400" />
              ) : (
                <Menu className="w-6 h-6 text-slate-600 dark:text-slate-400" />
              )}
            </button>
            <span className="font-semibold text-lg text-slate-900 dark:text-white">
              Email Analyzer
            </span>
          </div>
          <ThemeToggle variant="icon" />
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile Menu Drawer */}
      <div
        className={`lg:hidden fixed top-14 left-0 bottom-0 z-40 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <nav className="p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setIsOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`
              }
            >
              {item.icon}
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Bottom Tab Bar (alternative mobile navigation) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 safe-area-pb">
        <nav className="flex justify-around items-center h-16">
          {navItems.slice(0, 5).map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`
              }
            >
              {item.icon}
              <span className="text-xs font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </>
  );
};

