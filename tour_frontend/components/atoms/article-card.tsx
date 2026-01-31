import React from "react";
import Link from "next/link";

interface ArticleCardProps {
  image: string;
  title: string;
  description: string;
  href?: string;
}

export function ArticleCard({
  image,
  title,
  description,
  href = "#",
}: ArticleCardProps) {
  return (
    <Link href={href} className="block">
      <div className="bg-white rounded-3xl overflow-hidden hover:shadow-xl transition-shadow cursor-pointer border border-gray-100 p-6">
        <div className="flex gap-6">
          <div className="overflow-hidden rounded-2xl w-64 h-64 flex-shrink-0">
            <img
              src={image}
              alt={title}
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
            />
          </div>
          <div className="flex-1 flex flex-col justify-between py-4">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                {title}
              </h3>
              <p className="text-base text-gray-500 leading-relaxed">
                {description}
              </p>
            </div>
            <span className="text-blue-600 text-sm font-bold hover:text-blue-700 self-end flex items-center gap-2 uppercase tracking-wide mt-4">
              READ MORE
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
