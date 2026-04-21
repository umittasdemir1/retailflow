import type { RetailFlowStrategy, StrategyConfig } from '@retailflow/shared';

const FALLBACK_PRESETS: StrategyConfig[] = [
  { name: 'sakin',     label: 'Calm',       description: '', minSourceDOS: 14, maxReceiverDOS: 7,  minInventory: 3, maxTransfer: 5,    deadStockStrThreshold: 0.15 },
  { name: 'kontrollu', label: 'Controlled', description: '', minSourceDOS: 10, maxReceiverDOS: 5,  minInventory: 2, maxTransfer: 10,   deadStockStrThreshold: 0.10 },
  { name: 'agresif',   label: 'Aggressive', description: '', minSourceDOS: 7,  maxReceiverDOS: 3,  minInventory: 1, maxTransfer: null, deadStockStrThreshold: 0.08 },
];

const FALLBACK_CUSTOM: StrategyConfig = {
  name: 'custom', label: 'Custom', description: '',
  minSourceDOS: 10, maxReceiverDOS: 5, minInventory: 2, maxTransfer: 10, deadStockStrThreshold: 0.10,
};

type RowKey = 'minSourceDOS' | 'maxReceiverDOS' | 'minInventory' | 'maxTransfer' | 'deadStockStrThreshold';

interface RowDef {
  key: RowKey;
  label: string;
  format: (v: number | null) => string;
  scale: number;
  nullable?: boolean;
  min: number;
  max: number;
}

const ROWS: RowDef[] = [
  { key: 'minSourceDOS',           label: 'Min. Kaynak Kapama (gün)',  format: (v) => `${v ?? 0}g`,                          scale: 1,   min: 0,  max: 365  },
  { key: 'maxReceiverDOS',         label: 'Max. Alıcı Kapama (gün)',   format: (v) => `${v ?? 0}g`,                          scale: 1,   min: 0,  max: 365  },
  { key: 'minInventory',           label: 'Min. Stok (adet)',          format: (v) => String(v ?? 0),                        scale: 1,   min: 0,  max: 999  },
  { key: 'maxTransfer',            label: 'Max. Transfer (adet)',      format: (v) => v == null ? '∞' : String(v),           scale: 1,   min: 1,  max: 999, nullable: true },
  { key: 'deadStockStrThreshold',  label: 'Ölü Stok Eşiği (STR%)',    format: (v) => `${Math.round((v ?? 0) * 100)}%`,      scale: 100, min: 0,  max: 100  },
];

interface Props {
  strategies: StrategyConfig[];
  selected: RetailFlowStrategy;
  onChange: (s: RetailFlowStrategy) => void;
  customConfig: Partial<StrategyConfig>;
  onCustomConfigChange: (cfg: Partial<StrategyConfig>) => void;
}

export function StrategySelector({ strategies, selected, onChange, customConfig, onCustomConfigChange }: Props) {
  const apiPresets = strategies.filter((s) => s.name !== 'custom');
  const presets = apiPresets.length > 0 ? apiPresets : FALLBACK_PRESETS;
  const defaultCustom = strategies.find((s) => s.name === 'custom') ?? FALLBACK_CUSTOM;
  const resolvedCustom: StrategyConfig = { ...defaultCustom, ...customConfig };
  const allCols: StrategyConfig[] = [...presets, resolvedCustom];

  function handleInput(key: RowKey, raw: string, row: RowDef) {
    if (row.nullable && raw === '') {
      onCustomConfigChange({ ...customConfig, [key]: null });
      return;
    }
    const num = parseFloat(raw);
    if (!isNaN(num)) {
      onCustomConfigChange({ ...customConfig, [key]: row.scale !== 1 ? num / row.scale : num });
    }
  }

  return (
    <div className="rf-strategy-table-wrap">
      <table className="rf-strategy-table">
        <thead>
          <tr>
            <th></th>
            {allCols.map((col) => (
              <th
                key={col.name}
                className={col.name === selected ? 'is-active' : ''}
                onClick={() => onChange(col.name as RetailFlowStrategy)}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.key}>
              <td>{row.label}</td>
              {allCols.map((col) => {
                const isActive = col.name === selected;
                const val = col[row.key] as number | null;
                return (
                  <td key={col.name} className={isActive ? 'is-active' : ''}>
                    {col.name === 'custom' ? (
                      <input
                        className="rf-strategy-input"
                        type="number"
                        min={row.min}
                        max={row.max}
                        value={val == null ? '' : Math.round(val * row.scale)}
                        placeholder={row.nullable ? '∞' : ''}
                        onChange={(e) => handleInput(row.key, e.target.value, row)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      row.format(val)
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
