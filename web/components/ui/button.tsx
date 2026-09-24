import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva('ui-button inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]', {
  variants: {
    variant: {
      default: 'ui-button-primary',
      secondary: 'ui-button-secondary',
      ghost: 'ui-button-ghost',
      outline: 'ui-button-outline',
    },
    size: { default: 'h-10 px-4', sm: 'h-8 px-3 text-xs', icon: 'size-10 p-0' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});

export function Button({ className, variant, size, asChild = false, ...props }: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Component = asChild ? Slot : 'button';
  return <Component data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
