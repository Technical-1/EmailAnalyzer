import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

interface ThemeToggleProps {
  variant?: 'icon' | 'dropdown' | 'buttons';
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ 
  variant = 'icon',
  className = '' 
}) => {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();

  if (variant === 'icon') {
    return (
      <button
        onClick={toggleTheme}
        className={`p-2 rounded-lg transition-colors hover:bg-slate-200 dark:hover:bg-slate-700 ${className}`}
        aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
        title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
      >
        {resolvedTheme === 'dark' ? (
          <Sun className="w-5 h-5 text-amber-400" />
        ) : (
          <Moon className="w-5 h-5 text-slate-600" />
        )}
      </button>
    );
  }

  if (variant === 'buttons') {
    return (
      <div className={`flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg ${className}`}>
        <button
          onClick={() => setTheme('light')}
          className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
            theme === 'light'
              ? 'bg-white dark:bg-slate-700 shadow-sm'
              : 'hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
          aria-pressed={theme === 'light'}
        >
          <Sun className={`w-4 h-4 ${theme === 'light' ? 'text-amber-500' : 'text-slate-500'}`} />
          <span className="text-sm font-medium">Light</span>
        </button>
        <button
          onClick={() => setTheme('dark')}
          className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
            theme === 'dark'
              ? 'bg-white dark:bg-slate-700 shadow-sm'
              : 'hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
          aria-pressed={theme === 'dark'}
        >
          <Moon className={`w-4 h-4 ${theme === 'dark' ? 'text-indigo-400' : 'text-slate-500'}`} />
          <span className="text-sm font-medium">Dark</span>
        </button>
        <button
          onClick={() => setTheme('system')}
          className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
            theme === 'system'
              ? 'bg-white dark:bg-slate-700 shadow-sm'
              : 'hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
          aria-pressed={theme === 'system'}
        >
          <Monitor className={`w-4 h-4 ${theme === 'system' ? 'text-blue-500' : 'text-slate-500'}`} />
          <span className="text-sm font-medium">System</span>
        </button>
      </div>
    );
  }

  // Dropdown variant
  return (
    <div className={`relative inline-block ${className}`}>
      <select
        value={theme}
        onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
        className="appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="light">☀️ Light</option>
        <option value="dark">🌙 Dark</option>
        <option value="system">💻 System</option>
      </select>
      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
};

