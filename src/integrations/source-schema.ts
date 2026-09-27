import type { SourceInspection } from './inspect';
// The absent upstream optional reward feed must not suppress valid runs.
export function sourceSchema(report: SourceInspection) {
  const unavailable = report.tables.filter(
    (t) => !t.present || t.missingRequired.length,
  );
  const optional = unavailable.filter(
    (t) =>
      report.integration === 'gauntlet' &&
      t.table === 'gauntlet_online_reward_events' &&
      !t.present,
  );
  return {
    compatible:
      report.status === 'connected' && unavailable.length === optional.length,
    partial: optional.length > 0,
    unavailable: unavailable.map((t) => t.table),
  };
}
