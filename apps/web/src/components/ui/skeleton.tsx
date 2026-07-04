import { cn } from '@/lib/utils';

export function Skeleton({
  className,
}: {
  className?: string;
}): React.ReactElement {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md bg-surface-2',
        'before:absolute before:inset-0 before:-translate-x-full',
        'before:animate-shimmer before:bg-gradient-to-r',
        'before:from-transparent before:via-white/5 before:to-transparent',
        className,
      )}
    />
  );
}
