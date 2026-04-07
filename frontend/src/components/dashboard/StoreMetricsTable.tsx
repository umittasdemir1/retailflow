import type { StoreMetrics } from '@retailflow/shared';

export function StoreMetricsTable(props: { stores: StoreMetrics[]; isLoading: boolean }) {
  if (props.isLoading) {
    return <div className="rf-inline-note">Mağaza metrikleri yükleniyor...</div>;
  }
  if (props.stores.length === 0) {
    return <div className="rf-inline-note">Veri yüklendikten sonra mağaza tablosu burada listelenir.</div>;
  }
  return (
    <div className="rf-table-wrap">
      <table className="rf-table">
        <thead>
          <tr>
            <th>Mağaza</th>
            <th>STR</th>
            <th>Satış</th>
            <th>Envanter</th>
            <th>Cover Günü</th>
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
              <td>{store.isPrioritySource ? 'Merkez/Online' : 'Mağaza'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
