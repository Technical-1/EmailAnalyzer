import { useMemo } from 'react';

interface HeatmapProps {
  data: number[][]; // 7 days x 24 hours
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => 
  i === 0 ? '12a' : i < 12 ? `${i}a` : i === 12 ? '12p' : `${i - 12}p`
);

export function Heatmap({ data }: HeatmapProps) {
  const { cells, maxValue } = useMemo(() => {
    const cells: { day: number; hour: number; value: number }[] = [];
    let maxValue = 0;

    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const value = data[day]?.[hour] || 0;
        cells.push({ day, hour, value });
        if (value > maxValue) maxValue = value;
      }
    }

    return { cells, maxValue };
  }, [data]);

  const getColor = (value: number): string => {
    if (maxValue === 0) return 'bg-slate-100 dark:bg-slate-700';
    
    const intensity = value / maxValue;
    
    if (intensity === 0) return 'bg-slate-100 dark:bg-slate-700';
    if (intensity < 0.2) return 'bg-blue-100 dark:bg-blue-900/30';
    if (intensity < 0.4) return 'bg-blue-200 dark:bg-blue-800/40';
    if (intensity < 0.6) return 'bg-blue-300 dark:bg-blue-700/50';
    if (intensity < 0.8) return 'bg-blue-400 dark:bg-blue-600/60';
    return 'bg-blue-500 dark:bg-blue-500/70';
  };

  if (!data || data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-slate-500 dark:text-slate-400">
        No activity data available
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[500px]">
        {/* Hour labels */}
        <div className="flex mb-1">
          <div className="w-10 flex-shrink-0" />
          {HOURS.filter((_, i) => i % 3 === 0).map((hour, i) => (
            <div
              key={hour}
              className="text-[10px] text-slate-500 dark:text-slate-400 text-center"
              style={{ width: `${(100 / 8)}%` }}
            >
              {hour}
            </div>
          ))}
        </div>

        {/* Grid */}
        {DAYS.map((day, dayIndex) => (
          <div key={day} className="flex items-center mb-0.5">
            <div className="w-10 flex-shrink-0 text-xs text-slate-500 dark:text-slate-400 pr-2 text-right">
              {day}
            </div>
            <div className="flex-1 flex gap-0.5">
              {HOURS.map((_, hourIndex) => {
                const cell = cells.find(c => c.day === dayIndex && c.hour === hourIndex);
                const value = cell?.value || 0;
                
                return (
                  <div
                    key={hourIndex}
                    className={`flex-1 h-5 rounded-sm ${getColor(value)} transition-colors cursor-default`}
                    title={`${day} ${HOURS[hourIndex]}: ${value} emails`}
                  />
                );
              })}
            </div>
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center justify-end mt-3 gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">Less</span>
          <div className="flex gap-0.5">
            {['bg-slate-100 dark:bg-slate-700', 'bg-blue-100 dark:bg-blue-900/30', 'bg-blue-200 dark:bg-blue-800/40', 'bg-blue-300 dark:bg-blue-700/50', 'bg-blue-400 dark:bg-blue-600/60', 'bg-blue-500 dark:bg-blue-500/70'].map((color, i) => (
              <div key={i} className={`w-4 h-4 rounded-sm ${color}`} />
            ))}
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">More</span>
        </div>
      </div>
    </div>
  );
}

