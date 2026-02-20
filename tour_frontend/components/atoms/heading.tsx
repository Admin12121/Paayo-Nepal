import React from 'react';

interface HeadingProps {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children: React.ReactNode;
  className?: string;
}

export function Heading({ level, children, className = '' }: HeadingProps) {
  const Tag = `h${level}` as keyof React.JSX.IntrinsicElements;
  const sizeStyles = {
    1: 'text-5xl font-bold',
    2: 'text-4xl font-bold',
    3: 'text-3xl font-bold',
    4: 'text-2xl font-bold',
    5: 'text-xl font-bold',
    6: 'text-lg font-bold'
  };

  return React.createElement(Tag, {
    className: `${sizeStyles[level]} ${className}`,
    children
  });
}
