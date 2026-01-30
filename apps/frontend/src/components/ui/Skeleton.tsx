// ===========================================
// Skeleton Components
// ===========================================

import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn('animate-pulse bg-gray-200 rounded', className)} />
  );
}

// Card Skeleton
export function CardSkeleton({ className }: SkeletonProps) {
  return (
    <div className={cn('bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100', className)}>
      <Skeleton className="aspect-[16/9]" />
      <div className="p-5 space-y-3">
        <Skeleton className="h-3 w-1/4" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-4 w-full" />
        <div className="flex justify-between pt-3">
          <Skeleton className="h-3 w-1/4" />
          <Skeleton className="h-3 w-1/6" />
        </div>
      </div>
    </div>
  );
}

// List Item Skeleton
export function ListItemSkeleton({ className }: SkeletonProps) {
  return (
    <div className={cn('flex gap-4', className)}>
      <Skeleton className="w-48 h-32 rounded-lg shrink-0" />
      <div className="flex-1 space-y-2 py-2">
        <Skeleton className="h-3 w-1/4" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-3 w-1/4 mt-4" />
      </div>
    </div>
  );
}

// Text Skeleton
export function TextSkeleton({ lines = 3, className }: SkeletonProps & { lines?: number }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          className={cn(
            'h-4',
            i === lines - 1 ? 'w-3/4' : 'w-full'
          )} 
        />
      ))}
    </div>
  );
}

// Avatar Skeleton
export function AvatarSkeleton({ size = 'md', className }: SkeletonProps & { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  return <Skeleton className={cn('rounded-full', sizes[size], className)} />;
}
