import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
}

export function Badge({ children, variant = 'primary' }: BadgeProps) {
  const baseStyles = 'px-3 py-1 rounded-full text-sm font-medium';
  const variantStyles = {
    primary: 'bg-blue-600 text-white',
    secondary: 'bg-gray-200 text-gray-800'
  };

  return (
    <span className={`${baseStyles} ${variantStyles[variant]}`}>
      {children}
    </span>
  );
}
