import type { AnalyzeResponse } from '../../lib/api';
import { StatCard } from '../ui/StatCard';

type AnalysisView = AnalyzeResponse['results'];

export function SummaryPanel(props: { analysis: AnalysisView | null }) {
  if (props.analysis == null) {
    return <div className="rf-inline-note">Analiz calistiktan sonra ozet kartlari burada gorunecek.</div>;
  }
  return (
    <div className="rf-summary-grid">
      <StatCard label="Transfer" value={props.analysis.totalTransferCount} detail={props.analysis.analysisType} accent="warm" />
      <StatCard label="Tasinan urun" value={props.analysis.simulation.totalItemsMoved} detail={props.analysis.strategy} accent="cool" />
      <StatCard label="Red" value={props.analysis.totalRejectedCount} detail={props.analysis.excludedCount + ' magaza dislandi'} accent="bright" />
      <StatCard label="Risk" value={props.analysis.simulation.riskLevel} detail={props.analysis.simulation.affectedStores + ' magaza etkilendi'} accent="deep" />
    </div>
  );
}
