import type { HealthResponse } from '../../lib/api';

export function StatusBadge(props: { health: HealthResponse | undefined }) {
  const healthy = props.health?.status === 'healthy';
  return (
    <div className={healthy ? 'rf-status-badge is-healthy' : 'rf-status-badge'}>
      {healthy ? 'API Hazir' : 'API bekleniyor'}
    </div>
  );
}
