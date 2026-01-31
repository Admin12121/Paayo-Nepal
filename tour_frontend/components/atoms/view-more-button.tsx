import { cn } from '@/lib/utils';
import Link from 'next/link';

interface ViewMoreButtonProps {
  className?: string;
  href?: string;
}

export function ViewMoreButton({ className, href = '#' }: ViewMoreButtonProps) {
  return (
    <div className={cn("flex items-center justify-center mt-12 gap-6", className)}>
      <div className="flex-1 h-px bg-[#D9D9D9]" />
      <Link 
        href={href}
        className="flex items-center gap-3 group cursor-pointer text-[#008cff]"
      >
        <span 
          className="font-bold text-xl tracking-[0.08em] uppercase"
        >
          VIEW MORE
        </span>
        <div className="w-8 h-8 rounded-full border-2 border-[#008cff] flex items-center justify-center transition-colors">
          <svg 
            width="24" 
            height="24" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
      </Link>
      <div className="flex-1 h-px bg-[#D9D9D9]" />
    </div>
  );
}
