import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ShoppingBag, TrendingUp } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { StatsCard } from '../components/StatsCard';
import { useAppStore } from '../store';

const categoryIcons: Record<string, string> = {
  ecommerce: '🛒',
  electronics: '📱',
  entertainment: '🎬',
  food: '🍔',
  groceries: '🥕',
  transportation: '🚗',
  payment: '💳',
  technology: '💻',
  travel: '✈️',
  home: '🏠',
  fashion: '👗',
  beauty: '💄',
  pets: '🐕',
  other: '📦',
};

export function PurchasesPage() {
  const navigate = useNavigate();
  const { purchases } = useAppStore();

  // Calculate stats in memory
  const { totalAmount, categoryTotals } = useMemo(() => {
    const total = purchases.reduce((sum, p) => sum + p.amount, 0);
    
    const categories = purchases.reduce((acc, purchase) => {
      const category = purchase.category || 'other';
      if (!acc[category]) {
        acc[category] = { count: 0, total: 0 };
      }
      acc[category].count++;
      acc[category].total += purchase.amount;
      return acc;
    }, {} as Record<string, { count: number; total: number }>);
    
    return { totalAmount: total, categoryTotals: categories };
  }, [purchases]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Purchases</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          {purchases.length} purchases detected from your emails
        </p>
      </div>

      {purchases.length > 0 ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <StatsCard
              title="Total Spent"
              value={`$${totalAmount.toFixed(2)}`}
              icon={ShoppingBag}
              iconColor="text-green-500"
            />
            <StatsCard
              title="Total Purchases"
              value={purchases.length}
              icon={TrendingUp}
              iconColor="text-blue-500"
            />
            <StatsCard
              title="Avg. Purchase"
              value={`$${(totalAmount / purchases.length).toFixed(2)}`}
              icon={ShoppingBag}
              iconColor="text-purple-500"
            />
          </div>

          {/* Category breakdown */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 mb-8">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              By Category
            </h2>
            <div className="flex flex-wrap gap-3">
              {Object.entries(categoryTotals).map(([category, data]) => (
                <div
                  key={category}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg"
                >
                  <span>{categoryIcons[category] || '📦'}</span>
                  <span className="font-medium text-slate-700 dark:text-slate-200 capitalize">
                    {category}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">
                    ${data.total.toFixed(2)} ({data.count})
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Purchase list */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Merchant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Order #
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {purchases.slice(0, 100).map(purchase => (
                  <tr
                    key={purchase.id}
                    onClick={() => purchase.emailId && navigate(`/emails/${purchase.emailId}`)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">
                          {categoryIcons[purchase.category] || '📦'}
                        </span>
                        <span className="font-medium text-slate-900 dark:text-white">
                          {purchase.merchant}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="capitalize text-slate-600 dark:text-slate-300">
                        {purchase.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      {format(purchase.purchaseDate, 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono text-sm">
                      {purchase.orderNumber || '-'}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-900 dark:text-white">
                      ${purchase.amount.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {purchases.length > 100 && (
              <div className="p-4 text-center text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700">
                Showing 100 of {purchases.length} purchases
              </div>
            )}
          </div>
        </>
      ) : (
        <EmptyState
          icon={ShoppingBag}
          title="No Purchases Detected"
          description="Upload an OLM file to automatically detect your purchases."
          actionLabel="Upload OLM File"
          actionTo="/"
        />
      )}
    </div>
  );
}
