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
            tick={{ fontSize: 10, fill: '#8d9aab', fontFamily: 'DM Mono, monospace' }}
            angle={-35}
            textAnchor="end"
            interval={0}
            tickLine={false}
            axisLine={false}
          />
          <YAxis tick={{ fontSize: 10, fill: '#8d9aab', fontFamily: 'DM Mono, monospace' }} unit="%" domain={[0, 100]} tickLine={false} axisLine={false} />
          <Tooltip
            formatter={(v) => [String(v) + '%', 'STR']}
            contentStyle={{
              borderRadius: 10,
              border: '1px solid #e3e7ef',
              background: '#ffffff',
              color: '#0f1923',
              boxShadow: '0 4px 20px rgba(15, 25, 40, 0.1)',
              fontFamily: 'DM Mono, monospace',
              fontSize: '12px',
            }}
            cursor={{ fill: 'rgba(15, 25, 40, 0.04)' }}
          />
          <Bar dataKey="str" name="STR" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.priority ? '#0f1923' : '#d1d9e6'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
