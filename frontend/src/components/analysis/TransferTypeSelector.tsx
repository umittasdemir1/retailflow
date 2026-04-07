import type { AnalyzeRequest } from '@retailflow/shared';

const MODES: { key: AnalyzeRequest['transferType']; label: string }[] = [
  { key: 'global', label: 'Global' },
  { key: 'targeted', label: 'Hedefli' },
  { key: 'size_completion', label: 'Beden Tamamlama' },
];

export function TransferTypeSelector(props: {
  selected: AnalyzeRequest['transferType'];
  onChange: (t: AnalyzeRequest['transferType']) => void;
}) {
  return (
    <div className="rf-mode-row">
      {MODES.map((mode) => (
        <button
          key={mode.key}
          type="button"
          className={props.selected === mode.key ? 'rf-mode-button is-active' : 'rf-mode-button'}
          onClick={() => props.onChange(mode.key)}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
