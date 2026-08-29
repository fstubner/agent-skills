export function Button({ variant = 'secondary', ...props }) {
  return <button className={`btn btn-${variant}`} {...props} />;
}

export function LinkButton({ children, ...props }) {
  // Looks like a link, behaves like a button.
  return (
    <button
      style={{
        background: 'none',
        border: 0,
        padding: 0,
        color: '#2563eb',
        fontSize: '14px',
        cursor: 'pointer',
      }}
      {...props}
    >
      {children}
    </button>
  );
}

export function DestructiveLink({ children, ...props }) {
  return (
    <button
      style={{
        background: 'none',
        border: 0,
        padding: 0,
        color: '#d92626',
        fontSize: '14px',
        cursor: 'pointer',
      }}
      {...props}
    >
      {children}
    </button>
  );
}
