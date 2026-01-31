import React from 'react';
import { cn } from '@/lib/utils';

interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  className?: string;
}

export function SectionHeading({ title, subtitle, className }: SectionHeadingProps) {
  return (
    <div className={cn("text-left mb-10", className)}>
      <h2 className="font-display text-[56px] font-medium text-[#1E1E1E] tracking-[0.04em] uppercase">
        {title}
      </h2>
      {subtitle && (
        <p className="text-[#868383] mt-3 text-lg">{subtitle}</p>
      )}
    </div>
  );
}
