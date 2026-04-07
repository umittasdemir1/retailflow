import type { StoreMetrics } from '@retailflow/shared';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export function StrChart(props: { stores: StoreMetrics[] }) {
  if (props.stores.length === 0) {
    return <div className="rf-inline-note">Veri yüklenince STR dağılımı burada görünecek.</div>;
  }

  const data = props.stores
    .slice()
    .sort((a, b) => b.strPercent - a.strPercent)
    .map((s) => ({ name: s.name, str: parseFloat(s.strPercent.toFixed(1)), priority: s.isPrioritySource }));

  return (
    <div style={{ width: '100%', height: 200 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 40 }}>
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            angle={-35}
            textAnchor="end"
            interval={0}
            tickLine={false}
            axisLine={false}
          />
          <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} unit="%" domain={[0, 100]} tickLine={false} axisLine={false} />
          <Tooltip
            formatter={(v) => String(v) + '%'}
            contentStyle={{ borderRadius: 14, border: '1px solid #e5e7eb', boxShadow: '0 12px 30px rgba(15, 23, 42, 0.08)' }}
            cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }}
          />
          <Bar dataKey="str" name="STR" radius={[6, 6, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.priority ? '#111827' : '#cbd5e1'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
