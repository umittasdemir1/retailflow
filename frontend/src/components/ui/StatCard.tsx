export function StatCard(props: { label: string; value: string | number; detail: string; accent: string }) {
  return (
    <article className={'rf-stat-card is-' + props.accent}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
      <small>{props.detail}</small>
    </article>
  );
}
