import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { 
  Newspaper, 
  Tag,
  ExternalLink,
  Search,
  Mail
} from 'lucide-react';
import { useAppStore } from '../store';
import { EmptyState } from '../components/EmptyState';

export function NewslettersPage() {
  const { newsletters, emails } = useAppStore();
  const [filter, setFilter] = useState<'all' | 'newsletter' | 'promotional'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter newsletters
  const filteredNewsletters = useMemo(() => {
    return newsletters.filter(nl => {
      if (filter === 'newsletter' && nl.isPromotional) return false;
      if (filter === 'promotional' && !nl.isPromotional) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return nl.senderName.toLowerCase().includes(query) || 
               nl.senderEmail.toLowerCase().includes(query);
      }
      return true;
    });
  }, [newsletters, filter, searchQuery]);

  // Calculate totals
  const totals = useMemo(() => {
    return {
      total: newsletters.length,
      newsletters: newsletters.filter(n => !n.isPromotional).length,
      promotional: newsletters.filter(n => n.isPromotional).length,
      totalEmails: newsletters.reduce((sum, n) => sum + n.emailCount, 0),
    };
  }, [newsletters]);

  if (emails.length === 0) {
    return (
      <EmptyState
        icon={Newspaper}
        title="No emails imported"
        description="Import your emails to detect newsletters and promotional emails"
      />
    );
  }

  if (newsletters.length === 0) {
    return (
      <EmptyState
        icon={Newspaper}
        title="No newsletters detected"
        description="No newsletters or promotional emails were found"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Newsletters & Promotions
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Manage newsletters and promotional emails with one-click unsubscribe
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm">
            <Newspaper className="w-4 h-4" />
            Total Senders
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {totals.total}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 text-blue-500 text-sm">
            <Mail className="w-4 h-4" />
            Newsletters
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {totals.newsletters}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 text-orange-500 text-sm">
            <Tag className="w-4 h-4" />
            Promotional
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {totals.promotional}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 text-purple-500 text-sm">
            <Mail className="w-4 h-4" />
            Total Emails
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {totals.totalEmails}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search senders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'all'
                ? 'bg-blue-500 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('newsletter')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'newsletter'
                ? 'bg-blue-500 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            Newsletters
          </button>
          <button
            onClick={() => setFilter('promotional')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'promotional'
                ? 'bg-orange-500 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            Promotional
          </button>
        </div>
      </div>

      {/* Newsletter List */}
      {filteredNewsletters.length > 0 ? (
        <div className="space-y-3">
          {filteredNewsletters.map((nl) => (
            <div
              key={nl.id}
              className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold">
                {nl.senderName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                    {nl.senderName}
                  </h3>
                  {nl.isPromotional ? (
                    <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs rounded-full">
                      Promotional
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs rounded-full">
                      Newsletter
                    </span>
                  )}
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400 truncate">
                  {nl.senderEmail}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-slate-900 dark:text-white">
                  {nl.emailCount} emails
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Last: {format(nl.lastEmailDate, 'MMM d')}
                </div>
              </div>
              {nl.unsubscribeLink && (
                <a
                  href={nl.unsubscribeLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Unsubscribe
                </a>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Newspaper}
          title="No newsletters found"
          description="No newsletter or promotional emails detected with current filters"
        />
      )}
    </div>
  );
}
