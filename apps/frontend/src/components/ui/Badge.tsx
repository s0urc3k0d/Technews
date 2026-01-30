// ===========================================
// Category Badge Component
// ===========================================

import Link from 'next/link';
import { Category } from '@/types';
import { cn } from '@/lib/utils';

interface CategoryBadgeProps {
  category: Category;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'outline' | 'ghost';
  showIcon?: boolean;
  className?: string;
}

export function CategoryBadge({ 
  category, 
  size = 'md', 
  variant = 'default',
  showIcon = true,
  className 
}: CategoryBadgeProps) {
  const baseStyles = 'inline-flex items-center font-medium rounded-full transition-colors';
  
  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  const variantStyles = {
    default: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
    outline: 'border border-blue-300 text-blue-700 hover:bg-blue-50',
    ghost: 'text-blue-600 hover:bg-blue-50',
  };

  return (
    <Link
      href={`/category/${category.slug}`}
      className={cn(
        baseStyles,
        sizeStyles[size],
        variantStyles[variant],
        className
      )}
    >
      {showIcon && category.icon && (
        <span className="mr-1">{category.icon}</span>
      )}
      {category.name}
    </Link>
  );
}

// Tag Badge
interface TagBadgeProps {
  tag: { id: string; name: string; slug: string };
  size?: 'sm' | 'md';
  className?: string;
}

export function TagBadge({ tag, size = 'md', className }: TagBadgeProps) {
  const sizeStyles = {
    sm: 'text-xs',
    md: 'text-sm',
  };

  return (
    <Link
      href={`/tag/${tag.slug}`}
      className={cn(
        'text-gray-500 hover:text-blue-600 transition-colors',
        sizeStyles[size],
        className
      )}
    >
      #{tag.name}
    </Link>
  );
}
