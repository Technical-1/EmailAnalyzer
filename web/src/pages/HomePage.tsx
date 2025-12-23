import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Mail, Users, Calendar, ShoppingBag, UserCheck, RefreshCw, Newspaper, 
  Paperclip, Building2, BarChart3, Upload, ArrowRight, TrendingUp,
  CheckCircle, Inbox, Star, Archive
} from 'lucide-react';
import { FileDropzone } from '../components/FileDropzone';
import { ProgressBar } from '../components/ProgressBar';
import { StatsCard } from '../components/StatsCard';
import { olmParser, type ProgressCallback } from '../services/olmParser';
import { useAppStore } from '../store';
import { SYSTEM_FOLDERS } from '../types';
import type { OLMProcessingProgress, OLMProcessingResult } from '../types';

export function HomePage() {
  const navigate = useNavigate();
  const { emails, accounts, purchases, contacts, calendarEvents, subscriptions, newsletters, refreshAll } = useAppStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<OLMProcessingProgress | null>(null);
  const [result, setResult] = useState<OLMProcessingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasData = emails.length > 0;

  const handleFileSelect = async (file: File) => {
    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const progressCallback: ProgressCallback = (p) => {
        setProgress(p);
      };

      const processingResult = await olmParser.parseOLMFile(file, progressCallback);
      setResult(processingResult);
      
      // Refresh the store with new data
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process file');
    } finally {
      setIsProcessing(false);
    }
  };

  // Show upload interface when no data
  if (!hasData && !result) {
    return (
      <div className="max-w-4xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-2xl shadow-blue-500/30 mb-6">
            <Archive className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-3">
            Email Archive Explorer
          </h1>
          <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto mb-4">
            Explore and search through your archived email files offline. 
            Perfect for reviewing old emails, finding important information, 
            or organizing years of correspondence.
          </p>
          <div className="flex flex-wrap justify-center gap-3 text-sm">
            <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
              📁 Works with .OLM files
            </span>
            <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
              🔒 100% Offline & Private
            </span>
            <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full">
              🔍 Full-Text Search
            </span>
          </div>
        </div>

        {/* Upload Area */}
        {!isProcessing ? (
          <FileDropzone onFileSelect={handleFileSelect} isProcessing={isProcessing} />
        ) : (
          progress && <ProgressBar progress={progress} />
        )}

        {error && (
          <div className="max-w-2xl mx-auto mt-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Feature Cards */}
        <div className="mt-16 grid md:grid-cols-3 gap-6">
          <FeatureCard
            icon={Mail}
            title="Browse & Search"
            description="Easily navigate through thousands of archived emails with powerful search and filtering"
            color="blue"
          />
          <FeatureCard
            icon={UserCheck}
            title="Auto-Discovery"
            description="Automatically find accounts, purchases, and subscriptions buried in your archives"
            color="purple"
          />
          <FeatureCard
            icon={BarChart3}
            title="Insights & Analytics"
            description="Visualize your email patterns, top senders, and activity over time"
            color="green"
          />
        </div>

        {/* Instructions */}
        <div className="mt-16 max-w-2xl mx-auto">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-6 text-center">
            How to export your OLM file
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <ol className="space-y-4">
              {[
                'Open Outlook for Mac',
                'Go to File → Export',
                'Select "Outlook for Mac Data File (.olm)"',
                'Choose what to export and save the file',
                'Drag the .olm file above to analyze it',
              ].map((step, i) => (
                <li key={i} className="flex gap-4 items-center">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="text-slate-600 dark:text-slate-300">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    );
  }

  // Show result after upload
  if (result) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="space-y-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Import Complete!
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Your email archive has been analyzed successfully
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <StatsCard title="Emails" value={result.emails} icon={Mail} iconColor="text-blue-500" />
            <StatsCard title="Accounts" value={result.accounts} icon={UserCheck} iconColor="text-purple-500" />
            <StatsCard title="Purchases" value={result.purchases} icon={ShoppingBag} iconColor="text-green-500" />
            <StatsCard title="Subscriptions" value={result.subscriptions} icon={RefreshCw} iconColor="text-cyan-500" />
            <StatsCard title="Newsletters" value={result.newsletters} icon={Newspaper} iconColor="text-amber-500" />
            <StatsCard title="Contacts" value={result.contacts} icon={Users} iconColor="text-orange-500" />
            <StatsCard title="Events" value={result.calendarEvents} icon={Calendar} iconColor="text-pink-500" />
          </div>

          <div className="flex justify-center gap-4">
            <button
              onClick={() => navigate('/emails')}
              className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              View Emails
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setResult(null);
                setProgress(null);
              }}
              className="px-6 py-3 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg font-medium transition-colors"
            >
              Upload Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show dashboard when we have data
  const inboxCount = emails.filter(e => e.folderId === SYSTEM_FOLDERS.INBOX).length;
  const unreadCount = emails.filter(e => !e.isRead && e.folderId === SYSTEM_FOLDERS.INBOX).length;
  const starredCount = emails.filter(e => e.isStarred).length;
  const attachmentCount = emails.reduce((sum, e) => sum + e.attachments.length, 0);

  const quickLinks = [
    { to: '/emails', icon: Inbox, label: 'Inbox', count: inboxCount, color: 'blue' },
    { to: '/emails?folder=favorites', icon: Star, label: 'Favorites', count: starredCount, color: 'yellow' },
    { to: '/accounts', icon: UserCheck, label: 'Accounts', count: accounts.length, color: 'purple' },
    { to: '/purchases', icon: ShoppingBag, label: 'Purchases', count: purchases.length, color: 'green' },
    { to: '/subscriptions', icon: RefreshCw, label: 'Subscriptions', count: subscriptions.length, color: 'cyan' },
    { to: '/newsletters', icon: Newspaper, label: 'Newsletters', count: newsletters.length, color: 'amber' },
    { to: '/senders', icon: Building2, label: 'Senders', count: new Set(emails.map(e => e.sender)).size, color: 'indigo' },
    { to: '/attachments', icon: Paperclip, label: 'Attachments', count: attachmentCount, color: 'pink' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Your Email Archive</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Exploring {emails.length.toLocaleString()} archived emails • Browse, search, and discover
          </p>
        </div>
        <Link
          to="/"
          onClick={(e) => {
            e.preventDefault();
            setResult(null);
            setProgress(null);
            setError(null);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
        >
          <Upload className="w-4 h-4" />
          Import More
        </Link>
      </div>
      
      {/* Info Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center flex-shrink-0">
            <Archive className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-medium text-slate-900 dark:text-white">Exploring Your Email Archive</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              All your emails are stored locally in your browser. Use the sidebar to browse by folder, 
              search for specific emails, or explore auto-detected accounts and purchases.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white">
          <div className="flex items-center justify-between">
            <Mail className="w-8 h-8 opacity-80" />
            {unreadCount > 0 && (
              <span className="px-2 py-1 bg-white/20 rounded-full text-xs font-medium">
                {unreadCount} unread
              </span>
            )}
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold">{emails.length.toLocaleString()}</div>
            <div className="text-blue-100 text-sm">Total Emails</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 text-white">
          <UserCheck className="w-8 h-8 opacity-80" />
          <div className="mt-4">
            <div className="text-3xl font-bold">{accounts.length}</div>
            <div className="text-purple-100 text-sm">Accounts Found</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-5 text-white">
          <ShoppingBag className="w-8 h-8 opacity-80" />
          <div className="mt-4">
            <div className="text-3xl font-bold">{purchases.length}</div>
            <div className="text-green-100 text-sm">Purchases Tracked</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl p-5 text-white">
          <RefreshCw className="w-8 h-8 opacity-80" />
          <div className="mt-4">
            <div className="text-3xl font-bold">{subscriptions.length}</div>
            <div className="text-cyan-100 text-sm">Active Subscriptions</div>
          </div>
        </div>
      </div>

      {/* Quick Links Grid */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Quick Access</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.to}
                to={link.to}
                className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-lg transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg bg-${link.color}-100 dark:bg-${link.color}-900/30 flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <Icon className={`w-5 h-5 text-${link.color}-600 dark:text-${link.color}-400`} />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">{link.label}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">{link.count.toLocaleString()}</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Analytics Link */}
      <Link
        to="/analytics"
        className="block bg-gradient-to-r from-slate-800 to-slate-900 dark:from-slate-700 dark:to-slate-800 rounded-xl p-6 text-white hover:shadow-xl transition-shadow"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">View Analytics</h3>
              <p className="text-slate-300 text-sm">See detailed charts and insights about your email patterns</p>
            </div>
          </div>
          <ArrowRight className="w-6 h-6 opacity-60" />
        </div>
      </Link>

      {/* Upload Area (collapsed) */}
      <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-6 border-2 border-dashed border-slate-300 dark:border-slate-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Upload className="w-8 h-8 text-slate-400" />
            <div>
              <h3 className="font-medium text-slate-900 dark:text-white">Import more emails</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Add another OLM or MBOX file to your collection</p>
            </div>
          </div>
          <label className="px-4 py-2 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-medium cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors">
            <input
              type="file"
              accept=".olm,.mbox,.mbx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
            />
            Choose File
          </label>
        </div>
        
        {isProcessing && progress && (
          <div className="mt-4">
            <ProgressBar progress={progress} />
          </div>
        )}
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description, color }: {
  icon: typeof Mail;
  title: string;
  description: string;
  color: 'blue' | 'purple' | 'green' | 'cyan';
}) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600 shadow-blue-500/20',
    purple: 'from-purple-500 to-purple-600 shadow-purple-500/20',
    green: 'from-green-500 to-green-600 shadow-green-500/20',
    cyan: 'from-cyan-500 to-cyan-600 shadow-cyan-500/20',
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
      <div className={`w-12 h-12 bg-gradient-to-br ${colorClasses[color]} rounded-xl flex items-center justify-center shadow-lg mb-4`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h3 className="font-semibold text-slate-900 dark:text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
    </div>
  );
}

