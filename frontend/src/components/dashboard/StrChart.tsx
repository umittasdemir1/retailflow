import type { StoreMetrics } from '@retailflow/shared';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export function StrChart(props: { stores: StoreMetrics[] }) {
  if (props.stores.length === 0) {
    return <div className="rf-inline-note">Veri yuklenince STR dagilimi burada gorunecek.</div>;
  }

  const data = props.stores
    .slice()
    .sort((a, b) => b.strPercent - a.strPercent)
    .map((s) => ({ name: s.name, str: parseFloat(s.strPercent.toFixed(1)), priority: s.isPrioritySource }));

  return (
    <div style={{ width: '100%', height: 200 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 40 }}>
          <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
          <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
          <Tooltip formatter={(v) => String(v) + '%'} />
          <Bar dataKey="str" name="STR" radius={[3, 3, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.priority ? '#6366f1' : '#22c55e'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
