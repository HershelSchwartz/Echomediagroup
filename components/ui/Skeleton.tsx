export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton rounded-md bg-surface-2 ${className}`} />;
}
