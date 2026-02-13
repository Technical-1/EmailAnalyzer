import type { LucideIcon } from 'lucide-react';

const colorMap: Record<string, string> = {
  blue: 'text-blue-500',
  orange: 'text-orange-500',
  cyan: 'text-cyan-500',
  green: 'text-green-500',
  red: 'text-red-500',
  purple: 'text-purple-500',
};

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: string;
  iconColor?: string;
}

export function StatsCard({ title, value, subtitle, icon: Icon, color, iconColor }: StatsCardProps) {
  const resolvedColor = iconColor || (color && colorMap[color]) || 'text-blue-500';

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
            {value}
          </p>
          {subtitle && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {subtitle}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-lg bg-slate-100 dark:bg-slate-700 ${resolvedColor}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

