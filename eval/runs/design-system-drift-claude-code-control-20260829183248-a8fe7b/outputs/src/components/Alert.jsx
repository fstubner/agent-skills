export function Alert({ kind = 'info', children }) {
  return <div className={`alert alert-${kind}`}>{children}</div>;
}

export function InlineError({ children }) {
  // One-off: the alert component was too heavy inside the booking form.
  return (
    <span style={{ color: '#dc2626', fontSize: '14px', marginTop: '4px' }}>
      {children}
    </span>
  );
}

export function FieldHint({ children }) {
  return (
    <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>{children}</span>
  );
}
