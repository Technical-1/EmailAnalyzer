# Phase 5: Analytics Dashboard

This document covers the email analytics and visualization features.

## Overview

Phase 5 adds a comprehensive analytics dashboard with charts for email volume, top senders, spending trends, and activity heatmaps.

## Features Implemented

### 1. Analytics Page

**Location:** `src/pages/AnalyticsPage.tsx`

Main dashboard showing email statistics and visualizations.

#### Statistics Cards:
- Total Emails (with 30-day count)
- Total Spending (with 30-day total)
- Account Count
- Unique Senders
- Average Emails per Day

### 2. Email Volume Chart

**Location:** `src/components/charts/VolumeChart.tsx`

Area chart showing email volume over time (monthly).

```tsx
import { VolumeChart } from './components/charts/VolumeChart';

const data = [
  { month: '2024-01', count: 150 },
  { month: '2024-02', count: 180 },
  // ...
];

<VolumeChart data={data} />
```

### 3. Top Senders Chart

**Location:** `src/components/charts/SendersChart.tsx`

Horizontal bar chart showing top 10 email senders.

```tsx
import { SendersChart } from './components/charts/SendersChart';

const data = [
  { name: 'Amazon', count: 45 },
  { name: 'Spotify', count: 30 },
  // ...
];

<SendersChart data={data} />
```

### 4. Spending Chart

**Location:** `src/components/charts/SpendingChart.tsx`

Area chart showing purchase spending over time.

```tsx
import { SpendingChart } from './components/charts/SpendingChart';

const data = [
  { month: '2024-01', amount: 250.00 },
  { month: '2024-02', amount: 180.50 },
  // ...
];

<SpendingChart data={data} />
```

### 5. Activity Heatmap

**Location:** `src/components/charts/Heatmap.tsx`

GitHub-style heatmap showing email activity by day of week and hour.

```tsx
import { Heatmap } from './components/charts/Heatmap';

// 7 days x 24 hours matrix
const data = [
  [0, 1, 2, 5, 10, ...], // Sunday
  [1, 3, 8, 15, ...],    // Monday
  // ...
];

<Heatmap data={data} />
```

## Dependencies

```json
{
  "recharts": "^2.x"
}
```

## Data Aggregation

The analytics page aggregates data in the following ways:

### Monthly Email Volume
```typescript
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
```

### Top Senders
```typescript
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
```

### Activity Heatmap
```typescript
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
```

## Chart Customization

### Color Schemes

Charts use consistent color schemes:
- Volume: Blue (#3b82f6)
- Senders: Purple (#8b5cf6)
- Spending: Green (#22c55e)
- Heatmap: Blue gradient (slate to blue-500)

### Dark Mode Support

All charts support dark mode through:
- Dark background colors
- Adjusted text colors
- Appropriate contrast ratios

### Responsive Design

Charts are fully responsive using Recharts' `ResponsiveContainer`:
- Adapts to container width
- Fixed heights (256px for most charts)
- Mobile-friendly tooltips

## Navigation

Access the analytics page via `/analytics` route or the sidebar navigation.

## Troubleshooting

### Charts Not Rendering

1. Verify recharts is installed: `npm install recharts`
2. Check data format matches expected structure
3. Ensure container has non-zero dimensions

### Empty Charts

1. Verify emails have been imported
2. Check date filtering logic
3. Confirm data transformation is correct

### Performance Issues

For large datasets (10,000+ emails):
1. Consider data sampling
2. Use Web Workers for aggregation
3. Implement virtualized rendering for heatmaps

