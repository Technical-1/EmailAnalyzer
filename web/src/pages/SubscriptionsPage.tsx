import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  RefreshCw, 
  DollarSign, 
  Calendar, 
  CheckCircle,
  Search,
  ChevronRight,
  Mail,
  X,
  ExternalLink
} from 'lucide-react';
import { useAppStore } from '../store';
import { EmptyState } from '../components/EmptyState';
import { Pagination } from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';
import type { Subscription, Email } from '../types';

const SUBSCRIPTIONS_PER_PAGE = 25;

export function SubscriptionsPage() {
  const { subscriptions, emails } = useAppStore();
  const [filter, setFilter] = useState<'all' | 'active' | 'cancelled'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);

  // Get emails for a subscription
  const getSubscriptionEmails = (sub: Subscription): Email[] => {
    return emails.filter(e => sub.emailIds.includes(e.id!));
  };

  // Filter subscriptions
  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter(sub => {
      if (filter !== 'all' && (filter === 'active') !== sub.isActive) return false;
      if (categoryFilter !== 'all' && sub.category !== categoryFilter) return false;
      if (searchQuery && !sub.serviceName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [subscriptions, filter, categoryFilter, searchQuery]);

  // Calculate totals
  const totals = useMemo(() => {
    const active = subscriptions.filter(s => s.isActive);
    const monthly = active.reduce((sum, s) => {
      const amount = s.monthlyAmount;
      if (s.frequency === 'yearly') return sum + amount / 12;
      if (s.frequency === 'weekly') return sum + amount * 4;
      return sum + amount;
    }, 0);
    return {
      total: subscriptions.length,
      active: active.length,
      monthlySpend: monthly,
      yearlySpend: monthly * 12,
    };
  }, [subscriptions]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(subscriptions.map(s => s.category));
    return Array.from(cats);
  }, [subscriptions]);

  const { currentPage, setCurrentPage, totalPages, pageItems, rangeStart, rangeEnd, totalItems } =
    usePagination(filteredSubscriptions, SUBSCRIPTIONS_PER_PAGE);

  if (emails.length === 0) {
    return (
      <EmptyState
        icon={RefreshCw}
        title="No emails imported"
        description="Import your emails to detect subscription services"
      />
    );
  }

  if (subscriptions.length === 0) {
    return (
      <EmptyState
        icon={RefreshCw}
        title="No subscriptions detected"
        description="No recurring subscription services were found in your emails"
      />
    );
  }

  const selectedEmails = selectedSubscription ? getSubscriptionEmails(selectedSubscription) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Subscriptions
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Track your recurring subscription services detected from emails
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm">
            <RefreshCw className="w-4 h-4" />
            Total Services
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {totals.total}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 text-green-500 text-sm">
            <CheckCircle className="w-4 h-4" />
            Active
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {totals.active}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 text-blue-500 text-sm">
            <DollarSign className="w-4 h-4" />
            Monthly Cost
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            ${totals.monthlySpend.toFixed(2)}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">all services combined</div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 text-purple-500 text-sm">
            <Calendar className="w-4 h-4" />
            Annual Cost
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            ${totals.yearlySpend.toFixed(2)}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">projected</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search services..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as 'all' | 'active' | 'cancelled')}
          className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
        >
          <option value="all">All Categories</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Subscription List */}
      {filteredSubscriptions.length > 0 ? (
        <>
        <div className="space-y-3">
          {pageItems.map((sub) => (
            <button
              key={sub.id}
              onClick={() => setSelectedSubscription(sub)}
              className="w-full text-left bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                {sub.serviceName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                    {sub.serviceName}
                  </h3>
                  {sub.isActive ? (
                    <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs rounded-full flex-shrink-0">
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs rounded-full flex-shrink-0">
                      Cancelled
                    </span>
                  )}
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {sub.category} • {sub.emailIds.length} related email{sub.emailIds.length !== 1 ? 's' : ''}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-semibold text-slate-900 dark:text-white">
                  {sub.currency === 'USD' ? '$' : sub.currency}
                  {sub.monthlyAmount.toFixed(2)}
                  <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                    /{sub.frequency === 'yearly' ? 'yr' : sub.frequency === 'weekly' ? 'wk' : 'mo'}
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Last: {format(sub.lastRenewalDate, 'MMM d, yyyy')}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
            </button>
          ))}
        </div>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          totalItems={totalItems}
          onPageChange={setCurrentPage}
          itemLabel="subscriptions"
          ariaLabel="Subscriptions pagination"
        />
        </>
      ) : (
        <EmptyState
          icon={RefreshCw}
          title="No subscriptions found"
          description="No subscription emails detected with current filters"
        />
      )}

      {/* Subscription Detail Modal */}
      {selectedSubscription && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setSelectedSubscription(null)}
        >
          <div 
            className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-xl">
                    {selectedSubscription.serviceName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                      {selectedSubscription.serviceName}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      {selectedSubscription.isActive ? (
                        <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs rounded-full">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs rounded-full">
                          Cancelled
                        </span>
                      )}
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        {selectedSubscription.category}
                      </span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedSubscription(null)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              
              {/* Subscription Details */}
              <div className="mt-4 grid grid-cols-3 gap-4">
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                  <div className="text-sm text-slate-500 dark:text-slate-400">Amount</div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {selectedSubscription.currency === 'USD' ? '$' : selectedSubscription.currency}
                    {selectedSubscription.monthlyAmount.toFixed(2)}
                    /{selectedSubscription.frequency === 'yearly' ? 'yr' : selectedSubscription.frequency === 'weekly' ? 'wk' : 'mo'}
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                  <div className="text-sm text-slate-500 dark:text-slate-400">Last Payment</div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {format(selectedSubscription.lastRenewalDate, 'MMM d, yyyy')}
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                  <div className="text-sm text-slate-500 dark:text-slate-400">Emails Found</div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {selectedSubscription.emailIds.length}
                  </div>
                </div>
              </div>
            </div>

            {/* Related Emails */}
            <div className="flex-1 overflow-y-auto p-6">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Related Emails
              </h3>
              
              {selectedEmails.length > 0 ? (
                <div className="space-y-2">
                  {selectedEmails.map(email => (
                    <Link
                      key={email.id}
                      to={`/emails/${email.id}`}
                      onClick={() => setSelectedSubscription(null)}
                      className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-900 dark:text-white truncate">
                          {email.subject || '(No Subject)'}
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          {format(email.date, 'MMM d, yyyy')} • {email.sender}
                        </div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  No related emails found
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
