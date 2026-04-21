import type { StoreMetrics, UploadResult } from '@retailflow/shared';
import type { HealthResponse } from '../../lib/api';
import { StatCard } from '../ui/StatCard';

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

export function OverviewCards(props: {
  uploadInfo: UploadResult | null;
  health: HealthResponse | undefined;
  stores: StoreMetrics[];
}) {
  const totalSales = props.stores.reduce((s, store) => s + store.totalSales, 0);
  const totalInventory = props.stores.reduce((s, store) => s + store.totalInventory, 0);
  const locationCount = props.uploadInfo?.storeCount ?? props.health?.storeCount ?? props.stores.length;

  return (
    <section className="rf-overview-grid">
      <StatCard
        label="Locations"
        value={locationCount || '—'}
        detail="Active store count"
        accent="warm"
      />
      <StatCard
        label="Products"
        value={props.uploadInfo ? fmt(props.uploadInfo.uniqueProductCount) : '—'}
        detail={props.uploadInfo ? props.uploadInfo.uniqueColorCount + ' unique colors' : 'No data loaded'}
        accent="cool"
      />
      <StatCard
        label="Sales"
        value={totalSales > 0 ? fmt(totalSales) : '—'}
        detail="Total sales count"
        accent="bright"
      />
      <StatCard
        label="Inventory"
        value={totalInventory > 0 ? fmt(totalInventory) : '—'}
        detail="Total stock count"
        accent="deep"
      />
    </section>
  );
}
