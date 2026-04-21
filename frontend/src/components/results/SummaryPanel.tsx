import { formatRiskLevelLabel, formatStrategyLabel, formatTransferTypeLabel } from '../../lib/labels';
import type { AnalyzeResponse } from '../../lib/api';
import { StatCard } from '../ui/StatCard';

type AnalysisView = AnalyzeResponse['results'];

export function SummaryPanel(props: { analysis: AnalysisView | null }) {
  if (props.analysis == null) {
    return <div className="rf-inline-note">Summary cards will appear after running analysis.</div>;
  }
  return (
    <div className="rf-summary-grid">
      <StatCard label="Transfer" value={props.analysis.totalTransferCount} detail={formatTransferTypeLabel(props.analysis.analysisType)} accent="warm" />
      <StatCard label="Items moved" value={props.analysis.simulation.totalItemsMoved} detail={formatStrategyLabel(props.analysis.strategy)} accent="cool" />
      <StatCard label="Rejected" value={props.analysis.totalRejectedCount} detail={props.analysis.excludedCount + ' stores excluded'} accent="bright" />
      <StatCard label="Risk" value={formatRiskLevelLabel(props.analysis.simulation.riskLevel)} detail={props.analysis.simulation.affectedStores + ' stores affected'} accent="deep" />
    </div>
  );
}
