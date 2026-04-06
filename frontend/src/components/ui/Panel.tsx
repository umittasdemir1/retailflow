import type { ReactNode } from 'react';

export function Panel(props: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="rf-panel">
      <header className="rf-panel-header">
        <div>
          <h2>{props.title}</h2>
          <p>{props.subtitle}</p>
        </div>
      </header>
      {props.children}
    </section>
  );
}
