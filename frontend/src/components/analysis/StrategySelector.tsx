import type { RetailFlowStrategy, StrategyConfig } from '@retailflow/shared';

function fallbackStrategies(): StrategyConfig[] {
  return [
    { name: 'sakin', label: 'Sakin', description: 'Güvenli transfer', minStrDiff: 0.15, minInventory: 3, maxTransfer: 5, targetCoverDays: 14, minCoverDays: 7, maxTransferPct: 0.25 },
    { name: 'kontrollu', label: 'Kontrollü', description: 'Dengeli transfer', minStrDiff: 0.1, minInventory: 2, maxTransfer: 10, targetCoverDays: 10, minCoverDays: 5, maxTransferPct: 0.4 },
    { name: 'agresif', label: 'Agresif', description: 'Performans odaklı transfer', minStrDiff: 0.08, minInventory: 1, maxTransfer: null, targetCoverDays: 7, minCoverDays: 3, maxTransferPct: 0.6 },
  ];
}

export function StrategySelector(props: {
  strategies: StrategyConfig[];
  selected: RetailFlowStrategy;
  onChange: (s: RetailFlowStrategy) => void;
}) {
  const cards = props.strategies.length > 0 ? props.strategies : fallbackStrategies();
  return (
    <div className="rf-strategy-grid">
      {cards.map((item) => (
        <button
          key={item.name}
          type="button"
          className={item.name === props.selected ? 'rf-strategy-card is-active' : 'rf-strategy-card'}
          onClick={() => props.onChange(item.name)}
        >
          <div className="rf-strategy-head">
            <strong>{item.label}</strong>
            <span>{item.minStrDiff * 100}% STR fark</span>
          </div>
          <p>{item.description}</p>
          <small>Min. stok {item.minInventory} · Maks. transfer {item.maxTransfer ?? 'sınırsız'}</small>
        </button>
      ))}
    </div>
  );
}

export function StrategyDetails(props: { config: StrategyConfig }) {
  return (
    <div className="rf-strategy-detail">
      <div><span>Hedef cover günü</span><strong>{props.config.targetCoverDays}</strong></div>
      <div><span>Min. cover günü</span><strong>{props.config.minCoverDays}</strong></div>
      <div><span>Maks. transfer oranı</span><strong>{Math.round(props.config.maxTransferPct * 100)}%</strong></div>
      <div><span>Maks. transfer</span><strong>{props.config.maxTransfer ?? 'Sınırsız'}</strong></div>
    </div>
  );
}
