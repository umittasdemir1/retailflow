import type { StoreMetrics } from '@retailflow/shared';

export function StoreMetricsTable(props: { stores: StoreMetrics[]; isLoading: boolean }) {
  if (props.isLoading) {
    return <div className="rf-inline-note">Loading store metrics...</div>;
  }
  if (props.stores.length === 0) {
    return <div className="rf-inline-note">Store table will appear after data is loaded.</div>;
  }
  return (
    <div className="rf-table-wrap">
      <table className="rf-table">
        <thead>
          <tr>
            <th>Store</th>
            <th>STR</th>
            <th>Sales</th>
            <th>Inventory</th>
            <th>Cover Days</th>
            <th>Source</th>
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
              <td>{store.isPrioritySource ? 'Hub/Online' : 'Store'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
