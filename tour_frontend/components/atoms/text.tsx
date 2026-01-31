import React from 'react';

interface TextProps {
  children: React.ReactNode;
  size?: 'sm' | 'base' | 'lg';
  className?: string;
}

export function Text({ children, size = 'base', className = '' }: TextProps) {
  const sizeStyles = {
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg'
  };

  return (
    <p className={`${sizeStyles[size]} text-gray-600 ${className}`}>
      {children}
    </p>
  );
}
