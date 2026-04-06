import type { StoreMetrics } from '@retailflow/shared';

export function StoreMetricsTable(props: { stores: StoreMetrics[]; isLoading: boolean }) {
  if (props.isLoading) {
    return <div className="rf-inline-note">Magaza metrikleri yukleniyor...</div>;
  }
  if (props.stores.length === 0) {
    return <div className="rf-inline-note">Veri yuklendikten sonra magaza tablosu burada listelenir.</div>;
  }
  return (
    <div className="rf-table-wrap">
      <table className="rf-table">
        <thead>
          <tr>
            <th>Magaza</th>
            <th>STR</th>
            <th>Satis</th>
            <th>Envanter</th>
            <th>Cover</th>
            <th>Kaynak</th>
          </tr>
        </thead>
        <tbody>
          {props.stores.map((store) => (
            <tr key={store.name}>
              <td>{store.name}</td>
              <td>{store.strPercent.toFixed(1)}%</td>
              <td>{store.totalSales}</td>
              <td>{store.totalInventory}</td>
              <td>{store.coverDays == null ? 'N/A' : store.coverDays.toFixed(1)}</td>
              <td>{store.isPrioritySource ? 'Merkez/Online' : 'Magaza'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
