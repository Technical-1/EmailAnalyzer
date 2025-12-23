import { useState } from 'react';
import { Link, Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { 
  Mail, Users, ShoppingBag, Calendar, Settings, Upload, UserCheck, Building2, 
  Archive, Trash2, Star, BarChart3, RefreshCw, Newspaper, Paperclip, Shield,
  ChevronDown, ChevronRight, Home, Inbox, TrendingUp, Folder, Wrench,
  Send, FileText, AlertTriangle,
  type LucideIcon
} from 'lucide-react';
import { useAppStore } from '../store';
import { SYSTEM_FOLDERS } from '../types';
import { ThemeToggle } from './ThemeToggle';
import jkLogo from '../assets/jk-logo.svg';

interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  folder?: string | null;
  badge?: 'count' | 'new';
}

interface NavSection {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
  defaultOpen?: boolean;
}

// Icon mapping for system folders
const folderIcons: Record<string, LucideIcon> = {
  inbox: Inbox,
  sent: Send,
  drafts: FileText,
  spam: AlertTriangle,
  archive: Archive,
  trash: Trash2,
  favorites: Star,
};

// Base sections (non-mail)
const staticSections: NavSection[] = [
  {
    id: 'insights',
    label: 'Insights',
    icon: TrendingUp,
    defaultOpen: true,
    items: [
      { to: '/senders', icon: Building2, label: 'Senders' },
      { to: '/accounts', icon: UserCheck, label: 'Accounts' },
      { to: '/purchases', icon: ShoppingBag, label: 'Purchases' },
      { to: '/subscriptions', icon: RefreshCw, label: 'Subscriptions' },
      { to: '/newsletters', icon: Newspaper, label: 'Newsletters' },
    ],
  },
  {
    id: 'organize',
    label: 'Organize',
    icon: Folder,
    defaultOpen: false,
    items: [
      { to: '/attachments', icon: Paperclip, label: 'Attachments' },
      { to: '/contacts', icon: Users, label: 'Contacts' },
      { to: '/calendar', icon: Calendar, label: 'Calendar' },
    ],
  },
  {
    id: 'tools',
    label: 'Tools',
    icon: Wrench,
    defaultOpen: false,
    items: [
      { to: '/analytics', icon: BarChart3, label: 'Analytics' },
      { to: '/backup', icon: Shield, label: 'Backup & Security' },
      { to: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
];

export function Layout() {
  const { emails, folders } = useAppStore();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const currentFolder = searchParams.get('folder');
  
  // Build mail section dynamically from folders
  const buildMailItems = (): NavItem[] => {
    const items: NavItem[] = [];
    
    // Always show Inbox first (folder: null means inbox)
    items.push({ to: '/emails', icon: Inbox, label: 'Inbox', folder: null });
    
    // Always show Favorites (based on isStarred flag)
    items.push({ to: '/emails?folder=favorites', icon: Star, label: 'Favorites', folder: 'favorites' });
    
    // Add system folders in order: Sent, Drafts, Spam
    const systemOrder = ['sent', 'drafts', 'spam'];
    for (const folderId of systemOrder) {
      const folder = folders.find(f => f.id === folderId);
      if (folder) {
        const count = emails.filter(e => e.folderId === folderId).length;
        if (count > 0) { // Only show if has emails
          items.push({
            to: `/emails?folder=${folderId}`,
            icon: folderIcons[folderId] || Folder,
            label: folder.name,
            folder: folderId,
          });
        }
      }
    }
    
    // Add custom folders (non-system)
    const customFolders = folders.filter(f => 
      !f.isSystem && 
      !['inbox', 'sent', 'drafts', 'spam', 'archive', 'trash'].includes(f.id)
    );
    for (const folder of customFolders) {
      const count = emails.filter(e => e.folderId === folder.id).length;
      if (count > 0) { // Only show if has emails
        items.push({
          to: `/emails?folder=${folder.id}`,
          icon: Folder,
          label: folder.name,
          folder: folder.id,
        });
      }
    }
    
    // Add Archive and Trash at the end
    items.push({ to: '/emails?folder=archive', icon: Archive, label: 'Archive', folder: 'archive' });
    items.push({ to: '/emails?folder=trash', icon: Trash2, label: 'Trash', folder: 'trash' });
    
    return items;
  };

  // Build nav sections with dynamic mail section
  const navSections: NavSection[] = [
    {
      id: 'mail',
      label: 'Mail',
      icon: Inbox,
      defaultOpen: true,
      items: buildMailItems(),
    },
    ...staticSections,
  ];
  
  // Track which sections are open
  const [openSections, setOpenSections] = useState<Set<string>>(() => {
    const defaultOpen = new Set<string>();
    defaultOpen.add('mail');
    defaultOpen.add('insights');
    return defaultOpen;
  });

  const toggleSection = (sectionId: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };
  
  // Get email count for any folder
  const getCounts = (folder?: string | null) => {
    if (folder === undefined) return null;
    if (folder === null) return emails.filter(e => e.folderId === SYSTEM_FOLDERS.INBOX).length;
    if (folder === 'favorites') return emails.filter(e => e.isStarred).length;
    // For any other folder, count emails in that folder
    return emails.filter(e => e.folderId === folder).length;
  };
  
  // Custom active check that considers both path and query params
  const isItemActive = (item: NavItem) => {
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

  const hasData = emails.length > 0;

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">
      {/* Sidebar - Fixed */}
      <aside className="w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col flex-shrink-0">
        {/* Logo Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-700">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25 group-hover:shadow-blue-500/40 transition-shadow">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                Email Analyzer
              </h1>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                OLM Archive Parser
              </p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto">
          {/* Home/Upload Link */}
          <Link
            to="/"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-3 transition-all ${
              location.pathname === '/'
                ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md shadow-blue-500/25'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {hasData ? <Home className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
            <span className="font-medium">{hasData ? 'Dashboard' : 'Upload'}</span>
          </Link>

          {/* Divider */}
          <div className="h-px bg-slate-200 dark:bg-slate-700 my-3" />

          {/* Navigation Sections */}
          <div className="space-y-1">
            {navSections.map((section) => {
              const isOpen = openSections.has(section.id);
              const SectionIcon = section.icon;
              const hasActiveItem = section.items.some(isItemActive);

              return (
                <div key={section.id}>
                  {/* Section Header */}
                  <button
                    onClick={() => toggleSection(section.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      hasActiveItem && !isOpen
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                  >
                    <SectionIcon className="w-4 h-4" />
                    <span className="flex-1 text-left text-sm font-medium">{section.label}</span>
                    {isOpen ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>

                  {/* Section Items */}
                  {isOpen && (
                    <ul className="mt-1 ml-3 pl-3 border-l border-slate-200 dark:border-slate-700 space-y-0.5">
                      {section.items.map((item) => {
                        const { to, icon: Icon, label, folder } = item;
                        const count = getCounts(folder);
                        const isActive = isItemActive(item);

                        return (
                          <li key={to}>
                            <Link
                              to={to}
                              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                                isActive
                                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                              }`}
                            >
                              <Icon className="w-4 h-4" />
                              <span className="flex-1">{label}</span>
                              {count !== null && count > 0 && (
                                <span className={`text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${
                                  folder === 'trash'
                                    ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                                    : isActive
                                      ? 'bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300'
                                      : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                                }`}>
                                  {count > 999 ? '999+' : count}
                                </span>
                              )}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <ThemeToggle variant="icon" />
            <a 
              href="https://jacobkanfer.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <img src={jkLogo} alt="JK" className="w-5 h-5 opacity-60 hover:opacity-100 transition-opacity" />
              <span>Jacob Kanfer</span>
            </a>
          </div>
        </div>
      </aside>

      {/* Main content - Scrollable */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 min-h-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
