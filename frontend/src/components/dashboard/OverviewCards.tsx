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
      <StatCard label="Yüklü satır" value={props.uploadInfo?.rowCount ?? 0} detail={props.uploadInfo?.fileName ?? 'Dosya yüklenmedi'} accent="warm" />
      <StatCard label="Mağaza" value={props.health?.storeCount ?? props.stores.length} detail="Analizde aktif mağaza sayısı" accent="cool" />
      <StatCard label="Satış / Envanter" value={totalSales + ' / ' + totalInventory} detail="Yüklenen veri üzerinden toplandı" accent="bright" />
      <StatCard label="Ortalama STR" value={averageStr.toFixed(1) + '%'} detail="Mağaza bazlı ortalama" accent="deep" />
    </section>
  );
}
