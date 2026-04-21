type StatusBadgeState = 'healthy' | 'loading' | 'offline';

const STATUS_LABEL: Record<StatusBadgeState, string> = {
  healthy: 'API ready',
  loading: 'API checking',
  offline: 'API unreachable',
};

export function StatusBadge(props: { state: StatusBadgeState }) {
  return (
    <div
      className={`rf-status-badge is-${props.state}`}
      role="status"
      aria-label={STATUS_LABEL[props.state]}
      title={STATUS_LABEL[props.state]}
    >
      <span className="rf-sr-only">{STATUS_LABEL[props.state]}</span>
    </div>
  );
}
