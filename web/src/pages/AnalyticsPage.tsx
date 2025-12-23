import { useMemo, useState } from 'react';
import { BarChart3, TrendingUp, Users, Clock, ChevronDown } from 'lucide-react';
import { useAppStore } from '../store';
import { VolumeChart } from '../components/charts/VolumeChart';
import { SendersChart } from '../components/charts/SendersChart';
import { SpendingChart } from '../components/charts/SpendingChart';
import { Heatmap } from '../components/charts/Heatmap';
import { StatsCard } from '../components/StatsCard';

export function AnalyticsPage() {
  const { emails, purchases } = useAppStore();
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');

  // Get available years from email data
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    emails.forEach((email) => {
      years.add(new Date(email.date).getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a); // Most recent first
  }, [emails]);

  // Filter data by selected year
  const filteredEmails = useMemo(() => {
    if (selectedYear === 'all') return emails;
    return emails.filter(e => new Date(e.date).getFullYear() === selectedYear);
  }, [emails, selectedYear]);

  const filteredPurchases = useMemo(() => {
    if (selectedYear === 'all') return purchases;
    return purchases.filter(p => new Date(p.purchaseDate).getFullYear() === selectedYear);
  }, [purchases, selectedYear]);

  // Calculate statistics based on filtered data
  const stats = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const recentEmails = filteredEmails.filter(e => new Date(e.date) >= thirtyDaysAgo);
    const uniqueSenders = new Set(filteredEmails.map(e => e.sender)).size;

    // Calculate date range for avg emails/day
    let dateRange = 1;
    if (filteredEmails.length > 0) {
      const sortedDates = filteredEmails.map(e => new Date(e.date).getTime()).sort((a, b) => a - b);
      const oldestDate = sortedDates[0];
      const newestDate = sortedDates[sortedDates.length - 1];
      dateRange = Math.max(1, Math.ceil((newestDate - oldestDate) / (1000 * 60 * 60 * 24)));
    }
    
    return {
      totalEmails: filteredEmails.length,
      recentEmails: recentEmails.length,
      uniqueSenders,
      avgEmailsPerDay: (filteredEmails.length / dateRange).toFixed(1),
    };
  }, [filteredEmails]);

  // Prepare data for charts using filtered data
  const volumeData = useMemo(() => {
    const monthlyData: Record<string, number> = {};
    
    filteredEmails.forEach((email) => {
      const date = new Date(email.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyData[key] = (monthlyData[key] || 0) + 1;
    });
    
    // If a specific year is selected, show all 12 months (even if 0)
    if (selectedYear !== 'all') {
      const result: { month: string; count: number }[] = [];
      for (let month = 1; month <= 12; month++) {
        const key = `${selectedYear}-${String(month).padStart(2, '0')}`;
        result.push({ month: key, count: monthlyData[key] || 0 });
      }
      return result;
    }
    
    // For 'all', show last 12 months
    return Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, count]) => ({ month, count }));
  }, [filteredEmails, selectedYear]);

  const senderData = useMemo(() => {
    const senderCounts: Record<string, number> = {};
    
    filteredEmails.forEach((email) => {
      const sender = email.senderName || email.sender.split('@')[0];
      senderCounts[sender] = (senderCounts[sender] || 0) + 1;
    });
    
    return Object.entries(senderCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
  }, [filteredEmails]);

  const spendingData = useMemo(() => {
    const monthlySpending: Record<string, number> = {};
    
    filteredPurchases.forEach((purchase) => {
      const date = new Date(purchase.purchaseDate);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlySpending[key] = (monthlySpending[key] || 0) + purchase.amount;
    });
    
    // If a specific year is selected, show all 12 months (even if 0)
    if (selectedYear !== 'all') {
      const result: { month: string; amount: number }[] = [];
      for (let month = 1; month <= 12; month++) {
        const key = `${selectedYear}-${String(month).padStart(2, '0')}`;
        result.push({ month: key, amount: monthlySpending[key] || 0 });
      }
      return result;
    }
    
    return Object.entries(monthlySpending)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, amount]) => ({ month, amount }));
  }, [filteredPurchases, selectedYear]);

  const heatmapData = useMemo(() => {
    const hourlyData: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));
    
    filteredEmails.forEach((email) => {
      const date = new Date(email.date);
      const day = date.getDay();
      const hour = date.getHours();
      hourlyData[day][hour]++;
    });
    
    return hourlyData;
  }, [filteredEmails]);

  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <BarChart3 className="w-16 h-16 text-slate-300 dark:text-slate-600 mb-4" />
        <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">
          No Data to Analyze
        </h2>
        <p className="text-slate-500 dark:text-slate-400">
          Upload an OLM file to see email analytics.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-blue-500" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Analytics</h1>
            <p className="text-slate-500 dark:text-slate-400">Email patterns and spending insights</p>
          </div>
        </div>
        
        {/* Year Selector */}
        <div className="relative">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
            className="appearance-none bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium px-4 py-2 pr-10 rounded-lg border border-slate-200 dark:border-slate-600 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          >
            <option value="all">All Time</option>
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard
          title="Total Emails"
          value={stats.totalEmails.toLocaleString()}
          subtitle={selectedYear === 'all' ? `${stats.recentEmails} in last 30 days` : `In ${selectedYear}`}
          icon={TrendingUp}
          color="blue"
        />
        <StatsCard
          title="Unique Senders"
          value={stats.uniqueSenders.toLocaleString()}
          subtitle={selectedYear === 'all' ? "Different email addresses" : `In ${selectedYear}`}
          icon={Users}
          color="orange"
        />
        <StatsCard
          title="Avg. Emails/Day"
          value={stats.avgEmailsPerDay}
          subtitle="Based on date range"
          icon={Clock}
          color="cyan"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Email Volume Chart */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Email Volume Over Time
          </h3>
          <VolumeChart data={volumeData} />
        </div>

        {/* Top Senders Chart */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Top 10 Senders
          </h3>
          <SendersChart data={senderData} />
        </div>

        {/* Spending Chart */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Spending Over Time
          </h3>
          <SpendingChart data={spendingData} />
        </div>

        {/* Activity Heatmap */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Email Activity Heatmap
          </h3>
          <Heatmap data={heatmapData} />
        </div>
      </div>
    </div>
  );
}

