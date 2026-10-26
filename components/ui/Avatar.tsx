/* eslint-disable @next/next/no-img-element */
export function Avatar({ name, src, size = 48 }: { name: string; src?: string | null; size?: number }) {
  const style = { width: size, height: size };
  if (src) return <img src={src} alt={`Photo of ${name}`} style={style} className="shrink-0 rounded-pill object-cover" />;
  return <span aria-hidden style={style} className="grid shrink-0 place-items-center rounded-pill bg-accent text-lg font-bold text-on-accent">{name[0] ?? "?"}</span>;
}
