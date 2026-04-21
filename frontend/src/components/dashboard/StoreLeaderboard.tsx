import type { StoreMetrics } from '@retailflow/shared';

export function StoreLeaderboard(props: { stores: StoreMetrics[] }) {
  return (
    <div className="rf-leaderboard">
      {props.stores.length === 0 ? (
        <div className="rf-inline-note">Top STR stores will appear after data is loaded.</div>
      ) : null}
      {props.stores.map((store, index) => (
        <article key={store.name} className="rf-leader-card">
          <span>#{index + 1}</span>
          <div>
            <strong>{store.name}</strong>
            <small>{store.totalSales} sales · {store.totalInventory} inventory</small>
          </div>
          <b>{store.strPercent.toFixed(1)}%</b>
        </article>
      ))}
    </div>
  );
}
