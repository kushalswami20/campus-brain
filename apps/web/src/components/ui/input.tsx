import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'flex h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm',
      'placeholder:text-muted focus-visible:outline-none focus-visible:ring-2',
      'focus-visible:ring-primary/50 disabled:opacity-50',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';
