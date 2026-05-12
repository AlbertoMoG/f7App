import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type EmptyStateAction = {
  label: string;
  to?: string;
  onClick?: () => void;
  variant?: 'default' | 'outline';
};

export interface EmptyStateCardProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  className?: string;
  primaryAction?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
}

function ActionButton({ action, className }: { action: EmptyStateAction; className?: string }) {
  const variant = action.variant ?? 'default';
  const isOutline = variant === 'outline';

  if (action.to) {
    return (
      <Link
        to={action.to}
        className={cn(
          buttonVariants({ variant: isOutline ? 'outline' : 'default', size: 'lg' }),
          'min-h-10 px-6',
          className
        )}
      >
        {action.label}
      </Link>
    );
  }
  return (
    <Button
      type="button"
      className={cn('min-h-10 px-6', className)}
      variant={isOutline ? 'outline' : 'default'}
      size="lg"
      onClick={action.onClick}
    >
      {action.label}
    </Button>
  );
}

export function EmptyStateCard({
  title,
  description,
  icon: Icon,
  className,
  primaryAction,
  secondaryAction,
}: EmptyStateCardProps) {
  return (
    <Card className={cn('border-2 border-dashed border-gray-100 bg-white shadow-none rounded-3xl', className)}>
      <CardContent className="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center">
        {Icon ? <Icon className="text-gray-200" size={48} strokeWidth={1.25} aria-hidden /> : null}
        <div className="space-y-2 max-w-md">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
        </div>
        {(primaryAction || secondaryAction) && (
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto sm:justify-center mt-2">
            {primaryAction ? <ActionButton action={{ ...primaryAction, variant: primaryAction.variant ?? 'default' }} /> : null}
            {secondaryAction ? <ActionButton action={{ ...secondaryAction, variant: secondaryAction.variant ?? 'outline' }} /> : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
