/**
 * Atlas brandmark — a retrieval graph: a central hub linked to source nodes.
 * Custom (not the generic "sparkles" AI cliché). Uses currentColor.
 */
export function Brandmark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 12 L12 4.5" />
      <path d="M12 12 L5 16.5" />
      <path d="M12 12 L19 16.5" />
      <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="4" r="1.9" fill="currentColor" stroke="none" />
      <circle cx="4.3" cy="17" r="1.9" fill="currentColor" stroke="none" />
      <circle cx="19.7" cy="17" r="1.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Wordmark used in the header / sidebar. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={className} style={{ letterSpacing: "0.14em" }}>
      ATLAS
    </span>
  );
}
