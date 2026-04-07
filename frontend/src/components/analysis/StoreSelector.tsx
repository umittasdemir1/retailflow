import type { AnalyzeRequest, StoreMetrics } from '@retailflow/shared';

export function StoreSelector(props: {
  transferType: AnalyzeRequest['transferType'];
  targetStore: string;
  excludedStores: string[];
  stores: StoreMetrics[];
  onTargetChange: (s: string) => void;
  onExcludedChange: (stores: string[]) => void;
}) {
  const targetOptions = props.stores.map((s) => s.name);
  const excludedOptions = props.stores.filter((s) => s.name !== props.targetStore);

  return (
    <>
      {props.transferType !== 'global' && (
        <label className="rf-field">
          <span>Hedef mağaza</span>
          <select value={props.targetStore} onChange={(e) => props.onTargetChange(e.target.value)}>
            {targetOptions.length === 0 ? <option value="">Mağaza bekleniyor</option> : null}
            {targetOptions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </label>
      )}
      <div className="rf-field">
        <span>Dışla</span>
        <div className="rf-check-list">
          {excludedOptions.length === 0 ? (
            <p className="rf-empty-inline">Dışlanabilecek mağaza yok.</p>
          ) : null}
          {excludedOptions.map((store) => {
            const checked = props.excludedStores.includes(store.name);
            return (
              <label key={store.name} className="rf-check-item">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    props.onExcludedChange(
                      checked
                        ? props.excludedStores.filter((s) => s !== store.name)
                        : [...props.excludedStores, store.name],
                    );
                  }}
                />
                <span>{store.name}</span>
                <small>{store.strPercent.toFixed(1)}% STR</small>
              </label>
            );
          })}
        </div>
      </div>
    </>
  );
}
