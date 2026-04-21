import { formatTransferTypeLabel } from '../../lib/labels';
import type { HealthResponse } from '../../lib/api';

export function HealthStrip(props: { health: HealthResponse | undefined }) {
  if (props.health == null) {
    return <div className="rf-inline-note">Loading API health...</div>;
  }
  return (
    <div className="rf-health-strip">
      <div><span>Service</span><strong>{props.health.service}</strong></div>
      <div><span>Version</span><strong>{props.health.version}</strong></div>
      <div><span>Memory</span><strong>{props.health.memoryUsagePercent}%</strong></div>
      <div><span>Active mode</span><strong>{formatTransferTypeLabel(props.health.transferType)}</strong></div>
    </div>
  );
}
