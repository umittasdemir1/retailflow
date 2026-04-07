type StatusBadgeState = 'healthy' | 'loading' | 'offline';

export function StatusBadge(props: { state: StatusBadgeState }) {
  const label =
    props.state === 'healthy'
      ? 'API hazır'
      : props.state === 'loading'
        ? 'API kontrol ediliyor'
        : 'API erişilemiyor';

  return (
    <div className={`rf-status-badge is-${props.state}`} role="status" aria-label={label} title={label}>
      <span className="rf-sr-only">{label}</span>
    </div>
  );
}
