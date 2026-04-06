import type { StoreMetrics, UploadResult } from '@retailflow/shared';
import type { HealthResponse } from '../../lib/api';
import { StatCard } from '../ui/StatCard';

export function OverviewCards(props: {
  uploadInfo: UploadResult | null;
  health: HealthResponse | undefined;
  stores: StoreMetrics[];
}) {
  const totalInventory = props.stores.reduce((s, store) => s + store.totalInventory, 0);
  const totalSales = props.stores.reduce((s, store) => s + store.totalSales, 0);
  const averageStr =
    props.stores.length > 0
      ? props.stores.reduce((s, store) => s + store.strPercent, 0) / props.stores.length
      : 0;

  return (
    <section className="rf-overview-grid">
      <StatCard label="Yuklu satir" value={props.uploadInfo?.rowCount ?? 0} detail={props.uploadInfo?.fileName ?? 'Dosya yuklenmedi'} accent="warm" />
      <StatCard label="Magaza" value={props.health?.storeCount ?? props.stores.length} detail="Analizde aktif magaza sayisi" accent="cool" />
      <StatCard label="Satis / Envanter" value={totalSales + ' / ' + totalInventory} detail="Yuklenen veri uzerinden toplandi" accent="bright" />
      <StatCard label="Ortalama STR" value={averageStr.toFixed(1) + '%'} detail="Magaza bazli ortalama" accent="deep" />
    </section>
  );
}
