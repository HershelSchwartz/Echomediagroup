import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

type Props = { icon?: ReactNode; title: ReactNode; subtitle?: ReactNode; trailing?: ReactNode; href?: string; onClick?: () => void };

export function ListRow({ icon, title, subtitle, trailing, href, onClick }: Props) {
  const inner = (
    <>
      {icon && <span className="grid h-10 w-10 shrink-0 place-items-center rounded-pill bg-surface text-text" aria-hidden>{icon}</span>}
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate font-medium">{title}</span>
        {subtitle && <span className="block truncate text-sm text-text-muted">{subtitle}</span>}
      </span>
      {trailing ?? ((href || onClick) && <ChevronRight className="h-5 w-5 text-text-muted" aria-hidden />)}
    </>
  );
  const cls = "flex min-h-14 w-full items-center gap-3 rounded-md px-2 py-2 hover:bg-surface";
  if (href) return <Link href={href} className={cls}>{inner}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{inner}</button>;
  return <div className={cls}>{inner}</div>;
}
