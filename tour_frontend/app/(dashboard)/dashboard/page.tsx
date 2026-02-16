import { headers } from "next/headers";
import { auth } from "@/lib/auth-server";
import { adminStatsApi, DashboardStats } from "@/lib/api-client";
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
  MessageSquare,
  Globe,
  BarChart3,
  ArrowUpRight,
  Sparkles,
  PenLine,
  Upload,
  Plus,
} from "lucide-react";
import Link from "next/link";
import DashboardRefresher from "@/components/dashboard/DashboardRefresher";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  iconBg: string;
  change?: string;
  href?: string;
}

function StatCard({ title, value, icon, iconBg, change, href }: StatCardProps) {
  const content = (
    <div className="group relative overflow-hidden rounded-xl border border-gray-100 bg-white p-5 transition-all hover:border-gray-200 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[13px] font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
            {value}
          </p>
          {change && (
            <p className="mt-1.5 text-xs font-medium text-gray-400">{change}</p>
          )}
        </div>
        <div
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${iconBg}`}
        >
          {icon}
        </div>
      </div>
      {href && (
        <div className="mt-3 flex items-center gap-1 text-xs font-medium text-blue-600 opacity-0 transition-opacity group-hover:opacity-100">
          View details
          <ArrowUpRight className="h-3 w-3" />
        </div>
      )}
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

function ViewsSummaryTable({ views }: { views: DashboardStats["views"] }) {
  if (!views || views.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
      <div className="border-b border-gray-50 px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <BarChart3 className="h-4 w-4 text-indigo-500" />
          Views Breakdown
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-50 bg-gray-50/50">
              <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                Content Type
              </th>
              <th className="px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-gray-400">
                Total Views
              </th>
              <th className="px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-gray-400">
                Unique Viewers
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {views.map((item) => (
              <tr
                key={item.target_type}
                className="transition-colors hover:bg-gray-50/50"
              >
                <td className="px-5 py-3">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                    <span className="text-sm font-medium capitalize text-gray-700">
                      {item.target_type.replace(/_/g, " ")}
                    </span>
                  </span>
                </td>
                <td className="px-5 py-3 text-right font-semibold tabular-nums text-gray-900">
                  {item.total_views.toLocaleString()}
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-gray-500">
                  {item.unique_viewers.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PostStatusBreakdown({ posts }: { posts: DashboardStats["posts"] }) {
  if (posts.total === 0) return null;

  const segments = [
    { label: "Published", value: posts.published, color: "bg-emerald-500" },
    { label: "Draft", value: posts.draft, color: "bg-amber-400" },
    { label: "Pending", value: posts.pending, color: "bg-orange-400" },
  ];

  const total = posts.total || 1;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
        <TrendingUp className="h-4 w-4 text-blue-500" />
        Post Status
      </h2>

      {/* Progress bar */}
      <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-gray-100">
        {segments.map(
          (seg) =>
            seg.value > 0 && (
              <div
                key={seg.label}
                className={`${seg.color} transition-all`}
                style={{ width: `${(seg.value / total) * 100}%` }}
              />
            ),
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        {segments.map((seg) => (
          <div key={seg.label} className="text-center">
            <p className="text-2xl font-bold tabular-nums text-gray-900">
              {seg.value.toLocaleString()}
            </p>
            <div className="mt-1 flex items-center justify-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${seg.color}`} />
              <span className="text-xs text-gray-500">{seg.label}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
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

  // Fetch real dashboard stats from the backend
  let stats: DashboardStats;
  try {
    stats = await adminStatsApi.getDashboardStats();
  } catch (err) {
    console.error("Failed to fetch dashboard stats:", err);
    stats = {
      posts: { total: 0, published: 0, draft: 0, pending: 0 },
      media: { total: 0 },
      events: { total: 0, upcoming: 0 },
      attractions: { total: 0 },
      regions: { total: 0 },
      users: {
        total: 0,
        active: 0,
        pending: 0,
        blocked: 0,
        admins: 0,
        editors: 0,
      },
      views: [],
      totalViews: 0,
      totalLikes: 0,
      comments: { pending: 0 },
      videos: { total: 0 },
      hotels: { total: 0 },
      photos: { total: 0 },
    };
  }

  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = session?.user?.name?.split(" ")[0] || "there";

  return (
    <div>
      <DashboardRefresher />

      {/* ─── Greeting ─── */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {greeting}, {firstName}
          <span className="ml-1 inline-block animate-pulse">👋</span>
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Here&apos;s what&apos;s happening with your content today.
        </p>
      </div>

      {/* Pending approval banner */}
      {isInactiveEditor && (
        <div className="mb-8 flex items-start gap-4 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-5">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-amber-900">
              Account Pending Approval
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-amber-700">
              Your account is being reviewed by an administrator. You can
              explore the dashboard but cannot create or upload content until
              your account is activated. You&apos;ll receive a notification when
              your account is verified.
            </p>
          </div>
        </div>
      )}

      {/* ─── Content Stats ─── */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Posts"
          value={stats.posts.total.toLocaleString()}
          icon={<FileText className="h-5 w-5 text-blue-600" />}
          iconBg="bg-blue-50"
          change={
            stats.posts.pending > 0
              ? `${stats.posts.pending} pending review`
              : `${stats.posts.published} published`
          }
          href="/dashboard/posts"
        />
        <StatCard
          title="Media Files"
          value={stats.media.total.toLocaleString()}
          icon={<ImageIcon className="h-5 w-5 text-purple-600" />}
          iconBg="bg-purple-50"
          href="/dashboard/media"
        />
        <StatCard
          title="Events"
          value={stats.events.total.toLocaleString()}
          icon={<Calendar className="h-5 w-5 text-emerald-600" />}
          iconBg="bg-emerald-50"
          change={`${stats.events.upcoming} upcoming`}
          href="/dashboard/events"
        />
        <StatCard
          title="Attractions"
          value={stats.attractions.total.toLocaleString()}
          icon={<MapPin className="h-5 w-5 text-rose-600" />}
          iconBg="bg-rose-50"
          href="/dashboard/attractions"
        />
      </div>

      {/* ─── Engagement Stats ─── */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Views"
          value={stats.totalViews.toLocaleString()}
          icon={<Eye className="h-5 w-5 text-indigo-600" />}
          iconBg="bg-indigo-50"
        />
        <StatCard
          title="Total Likes"
          value={stats.totalLikes.toLocaleString()}
          icon={<Heart className="h-5 w-5 text-pink-600" />}
          iconBg="bg-pink-50"
        />
        <StatCard
          title="Regions"
          value={stats.regions.total.toLocaleString()}
          icon={<Globe className="h-5 w-5 text-teal-600" />}
          iconBg="bg-teal-50"
          href="/dashboard/regions"
        />
        <StatCard
          title="Pending Comments"
          value={stats.comments.pending.toLocaleString()}
          icon={<MessageSquare className="h-5 w-5 text-amber-600" />}
          iconBg="bg-amber-50"
          change={stats.comments.pending > 0 ? "Needs moderation" : undefined}
        />
      </div>

      {/* ─── User Stats — admin only ─── */}
      {userRole === "admin" && stats.users.total > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Users"
            value={stats.users.total.toLocaleString()}
            icon={<Users className="h-5 w-5 text-sky-600" />}
            iconBg="bg-sky-50"
            change={`${stats.users.active} active`}
            href="/dashboard/users"
          />
          <StatCard
            title="Admins"
            value={stats.users.admins.toLocaleString()}
            icon={<ShieldAlert className="h-5 w-5 text-orange-600" />}
            iconBg="bg-orange-50"
          />
          <StatCard
            title="Editors"
            value={stats.users.editors.toLocaleString()}
            icon={<PenLine className="h-5 w-5 text-cyan-600" />}
            iconBg="bg-cyan-50"
          />
          <StatCard
            title="Pending / Blocked"
            value={`${stats.users.pending} / ${stats.users.blocked}`}
            icon={<Users className="h-5 w-5 text-gray-500" />}
            iconBg="bg-gray-100"
          />
        </div>
      )}

      {/* ─── Bottom Row: Status Breakdown + Views Table ─── */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PostStatusBreakdown posts={stats.posts} />
        <ViewsSummaryTable views={stats.views} />
      </div>

      {/* ─── Quick Actions — only for active users ─── */}
      {!isInactiveEditor && (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Sparkles className="h-4 w-4 text-blue-500" />
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Link
              href="/dashboard/posts/new"
              className="group flex items-center gap-3 rounded-xl border border-gray-100 bg-gradient-to-br from-blue-50 to-blue-100/50 px-4 py-4 transition-all hover:border-blue-200 hover:shadow-md"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 transition-transform group-hover:scale-105">
                <Plus className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Create Post
                </p>
                <p className="text-xs text-gray-500">Write new content</p>
              </div>
            </Link>

            <Link
              href="/dashboard/media"
              className="group flex items-center gap-3 rounded-xl border border-gray-100 bg-gradient-to-br from-purple-50 to-purple-100/50 px-4 py-4 transition-all hover:border-purple-200 hover:shadow-md"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-600 transition-transform group-hover:scale-105">
                <Upload className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Upload Media
                </p>
                <p className="text-xs text-gray-500">Add images & files</p>
              </div>
            </Link>

            <Link
              href="/dashboard/events/new"
              className="group flex items-center gap-3 rounded-xl border border-gray-100 bg-gradient-to-br from-emerald-50 to-emerald-100/50 px-4 py-4 transition-all hover:border-emerald-200 hover:shadow-md"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 transition-transform group-hover:scale-105">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Add Event</p>
                <p className="text-xs text-gray-500">Schedule an event</p>
              </div>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
