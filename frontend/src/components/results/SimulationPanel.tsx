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
      <div><span>Avg. DOS improvement</span><strong>{props.analysis.simulation.averageDosImprovement.toFixed(1)}g</strong></div>
      <div><span>Priority transfers</span><strong>{props.analysis.simulation.priorityTransfers}</strong></div>
      <div><span>Memory usage</span><strong>{props.analysis.memoryUsage.afterAnalysis}%</strong></div>
      <button type="button" className="rf-secondary-button" onClick={props.onRefresh} disabled={props.isRefreshing}>
        {props.isRefreshing ? 'Updating...' : 'Refresh Simulation'}
      </button>
    </div>
  );
}
