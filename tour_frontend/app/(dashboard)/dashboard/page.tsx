import { headers } from "next/headers";
import { auth } from "@/lib/auth-server";
import {
  FileText,
  Image as ImageIcon,
  Calendar,
  MapPin,
  Users,
  TrendingUp,
  Eye,
  Heart,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  change?: string;
  href?: string;
}

function StatCard({ title, value, icon, change, href }: StatCardProps) {
  const content = (
    <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-semibold text-gray-900 mt-2">{value}</p>
          {change && <p className="text-sm text-green-600 mt-1">{change}</p>}
        </div>
        <div className="p-3 bg-blue-50 rounded-full">{icon}</div>
      </div>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const userRole = (session?.user as Record<string, unknown>)?.role as string;
  const isActive =
    userRole === "admin"
      ? true
      : !!(session?.user as Record<string, unknown>)?.isActive;
  const isInactiveEditor = userRole === "editor" && !isActive;

  // In a real app, fetch these stats from your API
  const stats = {
    posts: { total: 0, pending: 0, published: 0 },
    media: { total: 0, thisMonth: 0 },
    events: { total: 0, upcoming: 0 },
    attractions: { total: 0 },
    totalViews: 0,
    totalLikes: 0,
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Welcome back, {session?.user.name}! Here's what's happening.
        </p>
      </div>

      {/* Pending approval banner */}
      {isInactiveEditor && (
        <div className="mb-8 flex items-start gap-4 rounded-lg border border-amber-200 bg-amber-50 p-6">
          <ShieldAlert className="mt-0.5 h-8 w-8 flex-shrink-0 text-amber-500" />
          <div>
            <h3 className="font-semibold text-amber-900">
              Account Pending Approval
            </h3>
            <p className="mt-1 text-amber-700">
              Your account is being reviewed by an administrator. You can
              explore the dashboard but cannot create or upload content until
              your account is activated.
            </p>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Posts"
          value={stats.posts.total}
          icon={<FileText className="w-6 h-6 text-blue-600" />}
          change={`${stats.posts.pending} pending approval`}
          href="/dashboard/posts"
        />
        <StatCard
          title="Media Files"
          value={stats.media.total}
          icon={<ImageIcon className="w-6 h-6 text-purple-600" />}
          change={`${stats.media.thisMonth} this month`}
          href="/dashboard/media"
        />
        <StatCard
          title="Events"
          value={stats.events.total}
          icon={<Calendar className="w-6 h-6 text-green-600" />}
          change={`${stats.events.upcoming} upcoming`}
          href="/dashboard/events"
        />
        <StatCard
          title="Attractions"
          value={stats.attractions.total}
          icon={<MapPin className="w-6 h-6 text-red-600" />}
          href="/dashboard/attractions"
        />
      </div>

      {/* Engagement Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <StatCard
          title="Total Views"
          value={stats.totalViews.toLocaleString()}
          icon={<Eye className="w-6 h-6 text-indigo-600" />}
          change="+12% from last month"
        />
        <StatCard
          title="Total Likes"
          value={stats.totalLikes.toLocaleString()}
          icon={<Heart className="w-6 h-6 text-pink-600" />}
          change="+8% from last month"
        />
      </div>

      {/* Quick Actions - only for active users */}
      {!isInactiveEditor && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/dashboard/posts/new"
              className="flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FileText className="w-5 h-5 mr-2" />
              Create New Post
            </Link>
            <Link
              href="/dashboard/media"
              className="flex items-center justify-center px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <ImageIcon className="w-5 h-5 mr-2" />
              Upload Media
            </Link>
            <Link
              href="/dashboard/events/new"
              className="flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Calendar className="w-5 h-5 mr-2" />
              Add Event
            </Link>
          </div>
        </div>
      )}

      {/* Recent Activity - Placeholder */}
      <div className="mt-8 bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Recent Activity
        </h2>
        <div className="text-center py-12 text-gray-500">
          <TrendingUp className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p>No recent activity to display</p>
        </div>
      </div>
    </div>
  );
}
