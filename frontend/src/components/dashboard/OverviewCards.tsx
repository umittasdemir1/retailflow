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
        label="Lokasyon"
        value={locationCount || '—'}
        detail="Aktif mağaza sayısı"
        accent="warm"
      />
      <StatCard
        label="Ürün"
        value={props.uploadInfo ? fmt(props.uploadInfo.uniqueProductCount) : '—'}
        detail={props.uploadInfo ? props.uploadInfo.uniqueColorCount + ' benzersiz renk' : 'Veri yüklenmedi'}
        accent="cool"
      />
      <StatCard
        label="Satış"
        value={totalSales > 0 ? fmt(totalSales) : '—'}
        detail="Toplam satış adedi"
        accent="bright"
      />
      <StatCard
        label="Envanter"
        value={totalInventory > 0 ? fmt(totalInventory) : '—'}
        detail="Toplam stok adedi"
        accent="deep"
      />
    </section>
  );
}
