import { useMemo } from 'react';
import { BarChart3, TrendingUp, DollarSign, Calendar, Users, Clock } from 'lucide-react';
import { useAppStore } from '../store';
import { VolumeChart } from '../components/charts/VolumeChart';
import { SendersChart } from '../components/charts/SendersChart';
import { SpendingChart } from '../components/charts/SpendingChart';
import { Heatmap } from '../components/charts/Heatmap';
import { StatsCard } from '../components/StatsCard';

export function AnalyticsPage() {
  const { emails, purchases, accounts } = useAppStore();

  // Calculate statistics
  const stats = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const recentEmails = emails.filter(e => new Date(e.date) >= thirtyDaysAgo);
    const totalSpending = purchases.reduce((sum, p) => sum + p.amount, 0);
    const recentSpending = purchases
      .filter(p => new Date(p.purchaseDate) >= thirtyDaysAgo)
      .reduce((sum, p) => sum + p.amount, 0);
    
    const uniqueSenders = new Set(emails.map(e => e.sender)).size;
    
    return {
      totalEmails: emails.length,
      recentEmails: recentEmails.length,
      totalSpending,
      recentSpending,
      accountCount: accounts.length,
      uniqueSenders,
    };
  }, [emails, purchases, accounts]);

  // Prepare data for charts
  const volumeData = useMemo(() => {
    const monthlyData: Record<string, number> = {};
    
    emails.forEach((email) => {
      const date = new Date(email.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyData[key] = (monthlyData[key] || 0) + 1;
    });
    
    return Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, count]) => ({ month, count }));
  }, [emails]);

  const senderData = useMemo(() => {
    const senderCounts: Record<string, number> = {};
    
    emails.forEach((email) => {
      const sender = email.senderName || email.sender.split('@')[0];
      senderCounts[sender] = (senderCounts[sender] || 0) + 1;
    });
    
    return Object.entries(senderCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
  }, [emails]);

  const spendingData = useMemo(() => {
    const monthlySpending: Record<string, number> = {};
    
    purchases.forEach((purchase) => {
      const date = new Date(purchase.purchaseDate);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlySpending[key] = (monthlySpending[key] || 0) + purchase.amount;
    });
    
    return Object.entries(monthlySpending)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, amount]) => ({ month, amount }));
  }, [purchases]);

  const heatmapData = useMemo(() => {
    const hourlyData: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));
    
    emails.forEach((email) => {
      const date = new Date(email.date);
      const day = date.getDay();
      const hour = date.getHours();
      hourlyData[day][hour]++;
    });
    
    return hourlyData;
  }, [emails]);

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
      <div className="flex items-center gap-3">
        <BarChart3 className="w-8 h-8 text-blue-500" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Analytics</h1>
          <p className="text-slate-500 dark:text-slate-400">Email patterns and spending insights</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatsCard
          title="Total Emails"
          value={stats.totalEmails.toLocaleString()}
          subtitle={`${stats.recentEmails} in last 30 days`}
          icon={TrendingUp}
          color="blue"
        />
        <StatsCard
          title="Total Spending"
          value={`$${stats.totalSpending.toFixed(2)}`}
          subtitle={`$${stats.recentSpending.toFixed(2)} in last 30 days`}
          icon={DollarSign}
          color="green"
        />
        <StatsCard
          title="Accounts"
          value={stats.accountCount.toString()}
          subtitle="Detected signups"
          icon={Calendar}
          color="purple"
        />
        <StatsCard
          title="Unique Senders"
          value={stats.uniqueSenders.toLocaleString()}
          subtitle="Different email addresses"
          icon={Users}
          color="orange"
        />
        <StatsCard
          title="Avg. Emails/Day"
          value={(stats.totalEmails / Math.max(1, Math.ceil((Date.now() - new Date(emails[emails.length - 1]?.date || Date.now()).getTime()) / (1000 * 60 * 60 * 24)))).toFixed(1)}
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

