import { formatTransferTypeLabel } from '../../lib/labels';
import type { HealthResponse } from '../../lib/api';

export function HealthStrip(props: { health: HealthResponse | undefined }) {
  if (props.health == null) {
    return <div className="rf-inline-note">API sağlığı yükleniyor...</div>;
  }
  return (
    <div className="rf-health-strip">
      <div><span>Servis</span><strong>{props.health.service}</strong></div>
      <div><span>Versiyon</span><strong>{props.health.version}</strong></div>
      <div><span>Bellek</span><strong>{props.health.memoryUsagePercent}%</strong></div>
      <div><span>Aktif mod</span><strong>{formatTransferTypeLabel(props.health.transferType)}</strong></div>
    </div>
  );
}
