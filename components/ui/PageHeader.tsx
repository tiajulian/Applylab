import { clsx } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
}

export function PageHeader({ title, subtitle, className }: PageHeaderProps) {
  return (
    <div className={clsx(className)}>
      <h1 className="font-display text-h2 text-ink">{title}</h1>
      {subtitle && <p className="mt-2 text-sm text-ink-secondary">{subtitle}</p>}
    </div>
  );
}
