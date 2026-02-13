import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface SendersChartProps {
  data: { name: string; count: number }[];
}

export function SendersChart({ data }: SendersChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-500 dark:text-slate-400">
        No data available
      </div>
    );
  }

  const formattedData = data.map((d) => ({
    ...d,
    shortName: truncateName(d.name, 15),
  }));

  return (
    <ResponsiveContainer width="100%" height={256}>
      <BarChart
        data={formattedData}
        layout="vertical"
        margin={{ top: 5, right: 10, left: 80, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 12, fill: '#64748b' }}
          tickLine={false}
          axisLine={{ stroke: '#e2e8f0' }}
        />
        <YAxis
          type="category"
          dataKey="shortName"
          tick={{ fontSize: 11, fill: '#64748b' }}
          tickLine={false}
          axisLine={{ stroke: '#e2e8f0' }}
          width={75}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1e293b',
            border: 'none',
            borderRadius: '8px',
            color: '#f1f5f9',
          }}
          labelStyle={{ color: '#94a3b8' }}
          formatter={(value: number | undefined) => [
            (value ?? 0).toLocaleString(),
            'Emails',
          ]}
        />
        <Bar
          dataKey="count"
          fill="#8b5cf6"
          radius={[0, 4, 4, 0]}
          barSize={20}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

function truncateName(name: string, maxLength: number): string {
  if (name.length <= maxLength) return name;
  return name.substring(0, maxLength - 3) + '...';
}

