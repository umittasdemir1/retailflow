import type { AnalyzeResponse } from '../../lib/api';

type AnalysisView = AnalyzeResponse['results'];

export function SimulationPanel(props: {
  analysis: AnalysisView | null;
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  if (props.analysis == null) return null;
  return (
    <div className="rf-simulation-panel">
      <div><span>Ortalama STR iyilesmesi</span><strong>{props.analysis.simulation.averageStrImprovement.toFixed(1)}%</strong></div>
      <div><span>Oncelikli transfer</span><strong>{props.analysis.simulation.priorityTransfers}</strong></div>
      <div><span>Bellek kullanimi</span><strong>{props.analysis.memoryUsage.afterAnalysis}%</strong></div>
      <button type="button" className="rf-secondary-button" onClick={props.onRefresh} disabled={props.isRefreshing}>
        {props.isRefreshing ? 'Guncelleniyor...' : 'Simulasyonu Yenile'}
      </button>
    </div>
  );
}
