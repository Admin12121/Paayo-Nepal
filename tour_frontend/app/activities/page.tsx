"use client";

import { useState, useEffect } from "react";
import { activitiesApi, Activity } from "@/lib/api-client";
import Image from "next/image";
import Link from "next/link";

// Breadcrumbs Component
function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="flex items-center gap-2 text-sm text-gray-600 mb-6">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          {item.href ? (
            <Link
              href={item.href}
              className="hover:text-[#0078C0] transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-[#0078C0] font-medium">{item.label}</span>
          )}
          {index < items.length - 1 && <span>/</span>}
        </div>
      ))}
    </nav>
  );
}

// Activity Card Component
function ActivityCard({ activity }: { activity: Activity }) {
  return (
    <Link href={`/activities/${activity.slug}`}>
      <div
        className="bg-white rounded-[20px] overflow-hidden cursor-pointer group transition-all duration-300 hover:shadow-xl"
        style={{ boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.08)" }}
      >
        <div className="overflow-hidden rounded-[16px] h-[320px] relative">
          {activity.featured_image ? (
            <Image
              src={activity.featured_image}
              alt={activity.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              placeholder={activity.featured_image_blur ? "blur" : "empty"}
              blurDataURL={activity.featured_image_blur || undefined}
            />
          ) : (
            <div className="w-full h-full bg-gray-200 flex items-center justify-center">
              <span className="text-6xl">{activity.icon || "🎯"}</span>
            </div>
          )}

          {/* Icon overlay */}
          {activity.icon && (
            <div className="absolute top-4 right-4 w-14 h-14 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center text-3xl shadow-lg">
              {activity.icon}
            </div>
          )}
        </div>
        <div className="p-6">
          <h3 className="font-display text-2xl font-semibold text-[#1A2B49] mb-3 text-center">
            {activity.name}
          </h3>
          {activity.description && (
            <p className="text-gray-600 text-sm leading-relaxed text-center line-clamp-3">
              {activity.description}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

// Activity Card Skeleton
function ActivityCardSkeleton() {
  return (
    <div
      className="bg-white rounded-[20px] overflow-hidden animate-pulse"
      style={{ boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.08)" }}
    >
      <div className="h-[320px] bg-gray-200"></div>
      <div className="p-6">
        <div className="h-7 bg-gray-200 rounded w-3/4 mx-auto mb-3"></div>
        <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-2/3 mx-auto"></div>
      </div>
    </div>
  );
}

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const limit = 12;

  useEffect(() => {
    fetchActivities();
  }, [currentPage]);

  const fetchActivities = async () => {
    try {
      setLoading(true);

      const response = await activitiesApi.list({
        page: currentPage,
        limit,
        is_active: true,
      });

      setActivities(response.data);
      setTotalPages(response.total_pages);
    } catch (err: any) {
      console.error("Failed to load activities:", err);
      setActivities([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#F8F9FA] min-h-screen pt-20">
      <div className="max-w-[1400px] mx-auto px-6 py-10">
        <Breadcrumbs
          items={[{ label: "Home", href: "/" }, { label: "Activities" }]}
        />

        {/* Page Header */}
        <div className="mb-10">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-[#1A2B49] mb-4">
            Activities in Nepal
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl">
            Discover thrilling adventures and cultural experiences in Nepal.
            From trekking in the Himalayas to cultural festivals, find your
            perfect activity.
          </p>
        </div>

        {/* Activities Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <ActivityCardSkeleton key={i} />
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">🎯</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No Activities Found
            </h3>
            <p className="text-gray-600">
              No activities available at the moment
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activities.map((activity) => (
                <ActivityCard key={activity.id} activity={activity} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-12">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium transition-colors ${
                        page === currentPage
                          ? "bg-[#0078C0] text-white"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {page}
                    </button>
                  ),
                )}

                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
