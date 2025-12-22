import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { 
  RefreshCw, 
  DollarSign, 
  Calendar, 
  CheckCircle,
  Search
} from 'lucide-react';
import { useAppStore } from '../store';
import { EmptyState } from '../components/EmptyState';

export function SubscriptionsPage() {
  const { subscriptions, emails } = useAppStore();
  const [filter, setFilter] = useState<'all' | 'active' | 'cancelled'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

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
            Monthly
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            ${totals.monthlySpend.toFixed(2)}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 text-purple-500 text-sm">
            <Calendar className="w-4 h-4" />
            Yearly
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            ${totals.yearlySpend.toFixed(2)}
          </div>
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
        <div className="space-y-3">
          {filteredSubscriptions.map((sub) => (
            <div
              key={sub.id}
              className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 flex items-center gap-4"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-900 dark:text-white">
                    {sub.serviceName}
                  </h3>
                  {sub.isActive ? (
                    <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs rounded-full">
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs rounded-full">
                      Cancelled
                    </span>
                  )}
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {sub.category} • {sub.emailIds.length} related emails
                </div>
              </div>
              <div className="text-right">
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
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={RefreshCw}
          title="No subscriptions found"
          description="No subscription emails detected with current filters"
        />
      )}
    </div>
  );
}
