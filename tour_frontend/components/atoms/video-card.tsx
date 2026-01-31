import React from 'react';
import { Eye } from 'lucide-react';

interface VideoCardProps {
  thumbnail: string;
  title: string;
  duration: string;
  views: number;
  channel: string;
  channelImage: string;
  date?: string;
}

export function VideoCard({ 
  thumbnail, 
  title, 
  duration, 
  views,
  channel,
  channelImage,
  date = "july 15 2025"
}: VideoCardProps) {
  // Format views count
  const formatViews = (count: number) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(0)}K`;
    }
    return count.toString();
  };

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-[10px] aspect-video bg-gray-200 group cursor-pointer">
        <img 
          src={thumbnail} 
          alt={title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        
        {/* View count badge - top right */}
        <div className="absolute top-3 right-3 bg-black/70 px-2.5 py-1 rounded-md flex items-center gap-1.5 text-white text-xs font-medium">
          <Eye className="w-3.5 h-3.5" />
          <span>{views}k</span>
        </div>
        
        {/* Duration badge - bottom right */}
        <div className="absolute bottom-10 right-3 bg-black/70 px-2.5 py-1 rounded-md text-white text-xs font-medium">
          {duration}
        </div>
        
        {/* Red progress bar at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gray-800/50">
          <div className="h-full w-1/4 bg-red-600"></div>
        </div>
      </div>
      
      <div className="space-y-1.5">
        <h4 className="text-base font-medium text-[#1E1E1E] line-clamp-2 leading-snug">
          {title}
        </h4>
        <p className="text-sm text-[#868383]">
          {date} • {formatViews(views * 100)} views
        </p>
      </div>
    </div>
  );
}
