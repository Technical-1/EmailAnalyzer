import { Link, Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { Mail, Users, ShoppingBag, Calendar, Settings, Upload, UserCheck, Building2, Archive, Trash2, Star, BarChart3, RefreshCw, Newspaper, Paperclip, Shield } from 'lucide-react';
import { useAppStore } from '../store';
import { SYSTEM_FOLDERS } from '../types';
import { ThemeToggle } from './ThemeToggle';
import jkLogo from '../assets/jk-logo.svg';

const navItems = [
  { to: '/', icon: Upload, label: 'Upload', hideWhenData: true },
  { to: '/emails', icon: Mail, label: 'Inbox', folder: null },
  { to: '/emails?folder=favorites', icon: Star, label: 'Favorites', folder: 'favorites' },
  { to: '/emails?folder=archive', icon: Archive, label: 'Archive', folder: 'archive' },
  { to: '/emails?folder=trash', icon: Trash2, label: 'Trash', folder: 'trash' },
  { to: '/senders', icon: Building2, label: 'Senders' },
  { to: '/accounts', icon: UserCheck, label: 'Accounts' },
  { to: '/purchases', icon: ShoppingBag, label: 'Purchases' },
  { to: '/subscriptions', icon: RefreshCw, label: 'Subscriptions' },
  { to: '/newsletters', icon: Newspaper, label: 'Newsletters' },
  { to: '/attachments', icon: Paperclip, label: 'Attachments' },
  { to: '/contacts', icon: Users, label: 'Contacts' },
  { to: '/calendar', icon: Calendar, label: 'Calendar' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/backup', icon: Shield, label: 'Backup' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function Layout() {
  const { emails } = useAppStore();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const currentFolder = searchParams.get('folder');
  
  const getCounts = (folder?: string | null) => {
    if (folder === undefined) return null;
    if (folder === 'favorites') return emails.filter(e => e.isStarred).length;
    if (folder === 'archive') return emails.filter(e => e.folderId === SYSTEM_FOLDERS.ARCHIVE).length;
    if (folder === 'trash') return emails.filter(e => e.folderId === SYSTEM_FOLDERS.TRASH).length;
    return null;
  };
  
  // Custom active check that considers both path and query params
  const isItemActive = (item: typeof navItems[0]) => {
    const [itemPath, itemQuery] = item.to.split('?');
    const itemFolder = itemQuery?.split('=')[1] ?? null;
    
    // Check if the path matches
    if (location.pathname !== itemPath) return false;
    
    // For email routes, also check folder param
    if (itemPath === '/emails') {
      return currentFolder === itemFolder;
    }
    
    return true;
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Mail className="w-6 h-6 text-blue-500" />
            Email Analyzer
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            OLM Archive Parser
          </p>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {navItems
              .filter(item => !(item.hideWhenData && emails.length > 0))
              .map((item) => {
                const { to, icon: Icon, label, folder } = item;
                const count = getCounts(folder);
                const isActive = isItemActive(item);
                
                return (
                  <li key={to}>
                    <Link
                      to={to}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="flex-1">{label}</span>
                      {count !== null && count > 0 && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          folder === 'trash' 
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                        }`}>
                          {count}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
          </ul>
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <ThemeToggle variant="icon" />
            <a 
              href="https://jacobkanfer.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <img src={jkLogo} alt="JK" className="w-6 h-6" />
              <span>Jacob Kanfer</span>
            </a>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

