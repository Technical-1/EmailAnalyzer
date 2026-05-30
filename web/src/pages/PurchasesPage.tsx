import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ShoppingBag, TrendingUp } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { StatsCard } from '../components/StatsCard';
import { Pagination } from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';
import { useAppStore } from '../store';

const PURCHASES_PER_PAGE = 50;

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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Calculate category totals from all purchases
  const categoryTotals = useMemo(() => {
    return purchases.reduce((acc, purchase) => {
      const category = purchase.category || 'other';
      if (!acc[category]) {
        acc[category] = { count: 0, total: 0 };
      }
      acc[category].count++;
      acc[category].total += purchase.amount;
      return acc;
    }, {} as Record<string, { count: number; total: number }>);
  }, [purchases]);

  // Filter purchases based on selected category
  const filteredPurchases = useMemo(() => {
    if (!selectedCategory) return purchases;
    return purchases.filter(p => (p.category || 'other') === selectedCategory);
  }, [purchases, selectedCategory]);

  // Calculate stats from filtered purchases
  const { totalAmount, avgAmount } = useMemo(() => {
    const total = filteredPurchases.reduce((sum, p) => sum + p.amount, 0);
    const avg = filteredPurchases.length > 0 ? total / filteredPurchases.length : 0;
    return { totalAmount: total, avgAmount: avg };
  }, [filteredPurchases]);

  const { currentPage, setCurrentPage, totalPages, pageItems, rangeStart, rangeEnd, totalItems } =
    usePagination(filteredPurchases, PURCHASES_PER_PAGE);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Purchases</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          {selectedCategory 
            ? `Showing ${filteredPurchases.length} of ${purchases.length} purchases in ${selectedCategory}`
            : `${purchases.length} purchases detected from your emails`
          }
        </p>
      </div>

      {purchases.length > 0 ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <StatsCard
              title={selectedCategory ? `Total Spent (${selectedCategory})` : "Total Spent"}
              value={`$${totalAmount.toFixed(2)}`}
              icon={ShoppingBag}
              iconColor="text-green-500"
            />
            <StatsCard
              title={selectedCategory ? `Purchases (${selectedCategory})` : "Total Purchases"}
              value={filteredPurchases.length}
              icon={TrendingUp}
              iconColor="text-blue-500"
            />
            <StatsCard
              title="Avg. Purchase"
              value={`$${avgAmount.toFixed(2)}`}
              icon={ShoppingBag}
              iconColor="text-purple-500"
            />
          </div>

          {/* Category Filter */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 mb-8">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Filter by Category
            </h2>
            <div className="flex flex-wrap gap-3">
              {/* All option */}
              <button
                onClick={() => { setSelectedCategory(null); setCurrentPage(1); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedCategory === null
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                <span>📊</span>
                <span>All</span>
                <span className={selectedCategory === null ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'}>
                  ({purchases.length})
                </span>
              </button>
              
              {Object.entries(categoryTotals)
                .sort((a, b) => b[1].total - a[1].total) // Sort by total amount
                .map(([category, data]) => (
                <button
                  key={category}
                  onClick={() => { setSelectedCategory(selectedCategory === category ? null : category); setCurrentPage(1); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedCategory === category
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  <span>{categoryIcons[category] || '📦'}</span>
                  <span className="capitalize">{category}</span>
                  <span className={selectedCategory === category ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'}>
                    ${data.total.toFixed(0)} ({data.count})
                  </span>
                </button>
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
                {pageItems.map(purchase => (
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
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            totalItems={totalItems}
            onPageChange={setCurrentPage}
            itemLabel="purchases"
            ariaLabel="Purchases pagination"
          />
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
