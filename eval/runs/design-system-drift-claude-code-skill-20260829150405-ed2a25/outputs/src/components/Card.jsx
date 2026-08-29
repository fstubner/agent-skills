export function Card({ title, meta, children }) {
  return (
    <section className="card">
      {title ? <h3 className="card-title">{title}</h3> : null}
      {meta ? <div className="card-meta">{meta}</div> : null}
      {children}
    </section>
  );
}

export function EmptyCard({ children }) {
  return <div className="card card-empty">{children}</div>;
}

export function HighlightCard({ title, children }) {
  // Used on the dashboard only. Predates components.css.
  return (
    <section
      style={{
        background: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '12px',
      }}
    >
      <h3 style={{ fontSize: '18px', color: '#1f2937', marginBottom: '8px' }}>
        {title}
      </h3>
      {children}
    </section>
  );
}
