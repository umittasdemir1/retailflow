import type { StoreMetrics } from '@retailflow/shared';

export function StoreLeaderboard(props: { stores: StoreMetrics[] }) {
  return (
    <div className="rf-leaderboard">
      {props.stores.length === 0 ? (
        <div className="rf-inline-note">Magaza listesi yuklenince en guclu STR kaynaklari burada gorunecek.</div>
      ) : null}
      {props.stores.map((store, index) => (
        <article key={store.name} className="rf-leader-card">
          <span>#{index + 1}</span>
          <div>
            <strong>{store.name}</strong>
            <small>{store.totalSales} satis · {store.totalInventory} envanter</small>
          </div>
          <b>{store.strPercent.toFixed(1)}%</b>
        </article>
      ))}
    </div>
  );
}
