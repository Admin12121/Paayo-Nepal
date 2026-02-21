"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "@/components/ui/animated-link";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import {
  ArrowUpRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  Columns3,
  FileText,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  adminStatsApi,
  api,
  DashboardStats,
  PaginatedResponse,
  PostRaw,
} from "@/lib/api-client";
import { getPostPublicPathByType } from "@/lib/post-routes";
import { useDashboard } from "@/lib/contexts/DashboardContext";
import DashboardRefresher from "@/components/dashboard/DashboardRefresher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberTicker } from "@/components/ui/number-ticker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const fallbackStats: DashboardStats = {
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

type TimeRange = "90d" | "30d" | "7d";
type ViewTab = "outline" | "published" | "pending" | "draft";
type PostTypeFilter = "all" | string;

type ColumnKey =
  | "type"
  | "status"
  | "target"
  | "limit"
  | "reviewer"
  | "created";

interface TimelinePoint {
  date: string;
  desktop: number;
  mobile: number;
}

interface DashboardRow {
  id: string;
  header: string;
  type: string;
  status: string;
  target: number;
  limit: number;
  reviewer: string;
  created: string;
  slug: string;
}

const chartConfig = {
  desktop: {
    label: "Views",
    color: "var(--chart-1)",
  },
  mobile: {
    label: "Likes",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const columnMeta: { key: ColumnKey; label: string }[] = [
  { key: "type", label: "Post Type" },
  { key: "status", label: "Status" },
  { key: "target", label: "Views" },
  { key: "limit", label: "Likes" },
  { key: "reviewer", label: "Reviewer" },
  { key: "created", label: "Created" },
];

function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}

function shortId(value: string): string {
  if (!value) return "-";
  if (value.length <= 11) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function truncateWords(value: string, maxWords = 45): string {
  const words = value.trim().split(/\s+/);
  if (words.length <= maxWords) return value;
  return `${words.slice(0, maxWords).join(" ")}...`;
}

function formatLabelDate(dateString: string): string {
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function buildTimeline(posts: PostRaw[], totalDays = 90): TimelinePoint[] {
  const end = new Date();
  end.setHours(0, 0, 0, 0);

  const start = new Date(end);
  start.setDate(end.getDate() - (totalDays - 1));

  const points = Array.from({ length: totalDays }, (_, index) => {
    const current = new Date(start);
    current.setDate(start.getDate() + index);

    return {
      date: current.toISOString().slice(0, 10),
      desktop: 0,
      mobile: 0,
    };
  });

  const map = new Map(points.map((point, index) => [point.date, index]));

  posts.forEach((post) => {
    const created = new Date(post.created_at);
    if (Number.isNaN(created.getTime())) return;

    created.setHours(0, 0, 0, 0);
    const key = created.toISOString().slice(0, 10);
    const pointIndex = map.get(key);
    if (pointIndex === undefined) return;

    points[pointIndex].desktop += post.view_count ?? 0;
    points[pointIndex].mobile += post.like_count ?? 0;
  });

  return points;
}

function statusBadgeVariant(
  status: string,
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "published":
      return "default";
    case "pending":
      return "secondary";
    case "draft":
      return "outline";
    default:
      return "outline";
  }
}

function formatPostType(value: string): string {
  if (!value) return "Post";
  return value
    .replace(/[-_]/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function DashboardPage() {
  const { userRole, isActive } = useDashboard();
  const isMobile = useIsMobile();
  const isInactiveEditor = userRole === "editor" && !isActive;

  const [stats, setStats] = useState<DashboardStats>(fallbackStats);
  const [posts, setPosts] = useState<PostRaw[]>([]);
  const [query, setQuery] = useState("");
  const [timeRange, setTimeRange] = useState<TimeRange>("90d");
  const [activeTab, setActiveTab] = useState<ViewTab>("outline");
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [postTypeFilter, setPostTypeFilter] = useState<PostTypeFilter>("all");
  const [columnVisibility, setColumnVisibility] = useState<
    Record<ColumnKey, boolean>
  >({
    type: true,
    status: true,
    target: true,
    limit: true,
    reviewer: true,
    created: true,
  });

  const fetchDashboardData = useCallback(async (silent = false) => {
    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    const [statsResult, postsResult] = await Promise.allSettled([
      adminStatsApi.getDashboardStats(),
      api.get<PaginatedResponse<PostRaw>>("/posts?limit=500&sort_by=latest", {
        cache: "no-store",
      }),
    ]);

    if (statsResult.status === "fulfilled") {
      setStats(statsResult.value);
    }

    if (postsResult.status === "fulfilled") {
      const ordered = [...postsResult.value.data].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      setPosts(ordered);
    }

    if (
      statsResult.status === "rejected" &&
      postsResult.status === "rejected"
    ) {
      toast.error("Failed to load dashboard data");
    }

    if (silent) {
      setIsRefreshing(false);
    } else {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoadTimeout = window.setTimeout(() => {
      fetchDashboardData(false).catch(() => {
        setIsLoading(false);
      });
    }, 0);

    const intervalId = window.setInterval(() => {
      fetchDashboardData(true).catch(() => {
        setIsRefreshing(false);
      });
    }, 30000);

    return () => {
      window.clearTimeout(initialLoadTimeout);
      window.clearInterval(intervalId);
    };
  }, [fetchDashboardData]);

  const totalUniqueViewers = useMemo(
    () => stats.views.reduce((sum, item) => sum + item.unique_viewers, 0),
    [stats.views],
  );

  const publishRate = useMemo(() => {
    if (stats.posts.total === 0) return 0;
    return Math.round((stats.posts.published / stats.posts.total) * 100);
  }, [stats.posts.published, stats.posts.total]);

  const activeRate = useMemo(() => {
    if (stats.users.total === 0) return 0;
    return Math.round((stats.users.active / stats.users.total) * 100);
  }, [stats.users.active, stats.users.total]);

  const timeline = useMemo(() => buildTimeline(posts, 90), [posts]);
  const activeRange: TimeRange =
    isMobile && timeRange === "90d" ? "7d" : timeRange;

  const filteredTimeline = useMemo(() => {
    const days = activeRange === "7d" ? 7 : activeRange === "30d" ? 30 : 90;
    return timeline.slice(-days);
  }, [activeRange, timeline]);

  const rows = useMemo<DashboardRow[]>(() => {
    return posts.map((post) => ({
      id: post.id,
      header: post.title,
      type: post.type,
      status: post.status,
      target: post.view_count ?? 0,
      limit: post.like_count ?? 0,
      reviewer: shortId(post.author_id),
      created: post.created_at,
      slug: post.slug,
    }));
  }, [posts]);

  const availablePostTypes = useMemo(() => {
    const uniqueTypes = Array.from(
      new Set(rows.map((row) => row.type.toLowerCase()).filter(Boolean)),
    );
    const preferredOrder = ["article", "event", "activity", "explore"];
    const extras = uniqueTypes
      .filter((type) => !preferredOrder.includes(type))
      .sort((a, b) => a.localeCompare(b));
    return [...preferredOrder, ...extras];
  }, [rows]);

  const showPostTypeColumn = postTypeFilter === "all" && columnVisibility.type;

  const visibleRows = useMemo(() => {
    const byTab = rows.filter((row) => {
      if (activeTab === "outline") return true;
      if (activeTab === "published") return row.status === "published";
      if (activeTab === "pending") return row.status === "pending";
      return row.status === "draft";
    });

    const byType =
      postTypeFilter === "all"
        ? byTab
        : byTab.filter((row) => row.type.toLowerCase() === postTypeFilter);

    const normalized = query.trim().toLowerCase();
    if (!normalized) return byType;

    return byType.filter((row) => {
      return (
        row.header.toLowerCase().includes(normalized) ||
        row.type.toLowerCase().includes(normalized) ||
        row.slug.toLowerCase().includes(normalized)
      );
    });
  }, [activeTab, postTypeFilter, query, rows]);

  const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const safePageIndex = Math.min(pageIndex, Math.max(0, totalPages - 1));

  const pageRows = useMemo(() => {
    const start = safePageIndex * pageSize;
    return visibleRows.slice(start, start + pageSize);
  }, [pageSize, safePageIndex, visibleRows]);

  const selectedOnPageCount = pageRows.filter((row) =>
    selectedRows.has(row.id),
  ).length;
  const allPageSelected =
    pageRows.length > 0 && selectedOnPageCount === pageRows.length;
  const somePageSelected = selectedOnPageCount > 0 && !allPageSelected;

  const rangeStart =
    visibleRows.length === 0 ? 0 : safePageIndex * pageSize + 1;
  const rangeEnd = Math.min(
    visibleRows.length,
    rangeStart + pageRows.length - 1,
  );

  const toggleAllOnPage = (checked: boolean) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      pageRows.forEach((row) => {
        if (checked) {
          next.add(row.id);
        } else {
          next.delete(row.id);
        }
      });
      return next;
    });
  };

  const toggleSingleRow = (rowId: string, checked: boolean) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(rowId);
      } else {
        next.delete(rowId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6 px-4 pb-8 md:px-6 lg:px-8">
      <DashboardRefresher />

      <div className="flex items-center justify-between pt-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Dashboard
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Content Operations
          </h1>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-600">
          {isRefreshing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-600" />
          ) : (
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
          )}
          {isRefreshing ? "Refreshing" : "Live"}
        </div>
      </div>

      {isInactiveEditor && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Account pending approval: content creation stays locked until an admin
          activates your editor account.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-4">
        <Card className="bg-gradient-to-b from-sky-50 to-white">
          <CardHeader>
            <CardDescription>Total Views</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              <NumberTicker
                value={stats.totalViews}
                className="tracking-normal text-current dark:text-current"
              />
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="border-sky-200 bg-sky-100/60">
                <ArrowUpRight className="h-3.5 w-3.5" />
                {formatCompact(totalUniqueViewers)} unique
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="text-sm text-slate-600">
            Across all content types
          </CardFooter>
        </Card>

        <Card className="bg-gradient-to-b from-emerald-50 to-white">
          <CardHeader>
            <CardDescription>Published Posts</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              <NumberTicker
                value={stats.posts.published}
                className="tracking-normal text-current dark:text-current"
              />
            </CardTitle>
            <CardAction>
              <Badge
                variant="outline"
                className="border-emerald-200 bg-emerald-100/60"
              >
                {publishRate}% live
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="text-sm text-slate-600">
            <NumberTicker
              value={stats.posts.total}
              className="tracking-normal text-current dark:text-current"
            />{" "}
            total posts
          </CardFooter>
        </Card>

        <Card className="bg-gradient-to-b from-indigo-50 to-white">
          <CardHeader>
            <CardDescription>Active Users</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              <NumberTicker
                value={stats.users.active}
                className="tracking-normal text-current dark:text-current"
              />
            </CardTitle>
            <CardAction>
              <Badge
                variant="outline"
                className="border-indigo-200 bg-indigo-100/60"
              >
                {activeRate}% active
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="text-sm text-slate-600">
            <NumberTicker
              value={stats.users.total}
              className="tracking-normal text-current dark:text-current"
            />{" "}
            total users
          </CardFooter>
        </Card>

        <Card className="bg-gradient-to-b from-amber-50 to-white">
          <CardHeader>
            <CardDescription>Open Queue</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              <NumberTicker
                value={stats.comments.pending + stats.posts.pending}
                className="tracking-normal text-current dark:text-current"
              />
            </CardTitle>
            <CardAction>
              <Badge
                variant="outline"
                className="border-amber-200 bg-amber-100/60"
              >
                <NumberTicker
                  value={stats.comments.pending}
                  className="tracking-normal text-current dark:text-current"
                />{" "}
                comments
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="text-sm text-slate-600">
            Pending moderation tasks
          </CardFooter>
        </Card>
      </div>

      <Card className="@container/card bg-white">
        <CardHeader>
          <CardTitle>Total Visitors</CardTitle>
          <CardDescription>
            <span className="hidden @[540px]/card:block">
              Real engagement trend from posts data
            </span>
            <span className="@[540px]/card:hidden">Engagement trend</span>
          </CardDescription>
          <CardAction>
            <ToggleGroup
              type="single"
              value={activeRange}
              onValueChange={(value) => {
                if (value) setTimeRange(value as TimeRange);
              }}
              variant="outline"
              className="hidden @[767px]/card:flex"
            >
              <ToggleGroupItem value="90d">Last 3 months</ToggleGroupItem>
              <ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
              <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
            </ToggleGroup>

            <Select
              value={activeRange}
              onValueChange={(value) => setTimeRange(value as TimeRange)}
            >
              <SelectTrigger
                className="flex w-40 @[767px]/card:hidden"
                size="sm"
                aria-label="Select time range"
              >
                <SelectValue placeholder="Last 3 months" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="90d">Last 3 months</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
              </SelectContent>
            </Select>
          </CardAction>
        </CardHeader>

        <CardContent className="px-2 pt-2 sm:px-6 sm:pt-4">
          <ChartContainer config={chartConfig} className="h-[260px] w-full">
            <AreaChart data={filteredTimeline}>
              <defs>
                <linearGradient id="fillDesktop" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-desktop)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-desktop)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
                <linearGradient id="fillMobile" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-mobile)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-mobile)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
              </defs>

              <CartesianGrid vertical={false} />

              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) =>
                  new Date(value).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                }
              />

              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) =>
                      new Date(
                        typeof value === "string" ||
                          typeof value === "number" ||
                          value instanceof Date
                          ? value
                          : Date.now(),
                      ).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    }
                    indicator="dot"
                  />
                }
              />

              <Area
                dataKey="mobile"
                type="natural"
                fill="url(#fillMobile)"
                stroke="var(--color-mobile)"
                name="Likes"
              />
              <Area
                dataKey="desktop"
                type="natural"
                fill="url(#fillDesktop)"
                stroke="var(--color-desktop)"
                name="Views"
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value as ViewTab);
          setPageIndex(0);
        }}
        className="w-full"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="outline">Outline</TabsTrigger>
            <TabsTrigger value="published">
              Published{" "}
              <Badge variant="secondary">{stats.posts.published}</Badge>
            </TabsTrigger>
            <TabsTrigger value="pending">
              Pending <Badge variant="secondary">{stats.posts.pending}</Badge>
            </TabsTrigger>
            <TabsTrigger value="draft">
              Draft <Badge variant="secondary">{stats.posts.draft}</Badge>
            </TabsTrigger>
          </TabsList>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <Input
              placeholder="Search title / post type / slug..."
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPageIndex(0);
              }}
              className="h-9 w-full sm:w-64"
            />

            <Select
              value={postTypeFilter}
              onValueChange={(value) => {
                setPostTypeFilter(value);
                setPageIndex(0);
              }}
            >
              <SelectTrigger
                className="h-9 w-[150px]"
                aria-label="Filter by post type"
              >
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {availablePostTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {formatPostType(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Columns3 className="h-4 w-4" />
                  Columns
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-52">
                {columnMeta.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.key}
                    checked={columnVisibility[column.key]}
                    onCheckedChange={(value) => {
                      setColumnVisibility((prev) => ({
                        ...prev,
                        [column.key]: Boolean(value),
                      }));
                    }}
                  >
                    {column.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Link href="/dashboard/posts/new">
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4" />
                Add new Post
              </Button>
            </Link>
          </div>
        </div>

        <TabsContent value={activeTab} className="mt-4 space-y-4">
          <div className="overflow-hidden rounded-lg border bg-white">
            <Table className="table-fixed">
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-10 text-center">
                    <Checkbox
                      checked={
                        allPageSelected
                          ? true
                          : somePageSelected
                            ? "indeterminate"
                            : false
                      }
                      onCheckedChange={(value) =>
                        toggleAllOnPage(Boolean(value))
                      }
                      aria-label="Select all rows"
                    />
                  </TableHead>
                  <TableHead className="w-[35%]">Header</TableHead>
                  {showPostTypeColumn && (
                    <TableHead className="w-[8%]">Post Type</TableHead>
                  )}
                  {columnVisibility.status && (
                    <TableHead className="w-[8%]">Status</TableHead>
                  )}
                  {columnVisibility.target && (
                    <TableHead className="w-[5%] text-right">Views</TableHead>
                  )}
                  {columnVisibility.limit && (
                    <TableHead className="w-[5%] text-right">Likes</TableHead>
                  )}
                  {columnVisibility.reviewer && (
                    <TableHead className="w-[12%]">Reviewer</TableHead>
                  )}
                  {columnVisibility.created && (
                    <TableHead className="w-[11%]">Created</TableHead>
                  )}
                  <TableHead className="w-12">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={
                        3 +
                        Number(showPostTypeColumn) +
                        Number(columnVisibility.status) +
                        Number(columnVisibility.target) +
                        Number(columnVisibility.limit) +
                        Number(columnVisibility.reviewer) +
                        Number(columnVisibility.created)
                      }
                      className="h-28 text-center text-slate-500"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading dashboard data...
                      </span>
                    </TableCell>
                  </TableRow>
                ) : pageRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={
                        3 +
                        Number(showPostTypeColumn) +
                        Number(columnVisibility.status) +
                        Number(columnVisibility.target) +
                        Number(columnVisibility.limit) +
                        Number(columnVisibility.reviewer) +
                        Number(columnVisibility.created)
                      }
                      className="h-24 text-center text-slate-500"
                    >
                      No results.
                    </TableCell>
                  </TableRow>
                ) : (
                  pageRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={selectedRows.has(row.id)}
                          onCheckedChange={(value) =>
                            toggleSingleRow(row.id, Boolean(value))
                          }
                          aria-label={`Select ${row.header}`}
                        />
                      </TableCell>

                      <TableCell className="max-w-[360px] lg:max-w-[520px]">
                        <Link
                          href={`/dashboard/posts/${row.slug}/edit`}
                          className="block truncate text-sm text-blue-600 hover:underline"
                          title={row.header}
                        >
                          {truncateWords(row.header, 35)}
                        </Link>
                        <p className="truncate text-xs text-slate-500">
                          /{row.slug}
                        </p>
                      </TableCell>

                      {showPostTypeColumn && (
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {formatPostType(row.type)}
                          </Badge>
                        </TableCell>
                      )}

                      {columnVisibility.status && (
                        <TableCell>
                          <Badge
                            variant={statusBadgeVariant(row.status)}
                            className="capitalize"
                          >
                            {row.status}
                          </Badge>
                        </TableCell>
                      )}

                      {columnVisibility.target && (
                        <TableCell className="text-right font-medium tabular-nums">
                          <NumberTicker
                            value={row.target}
                            className="tracking-normal text-current dark:text-current"
                          />
                        </TableCell>
                      )}

                      {columnVisibility.limit && (
                        <TableCell className="text-right tabular-nums">
                          <NumberTicker
                            value={row.limit}
                            className="tracking-normal text-current dark:text-current"
                          />
                        </TableCell>
                      )}

                      {columnVisibility.reviewer && (
                        <TableCell>{row.reviewer}</TableCell>
                      )}

                      {columnVisibility.created && (
                        <TableCell>{formatLabelDate(row.created)}</TableCell>
                      )}

                      <TableCell className="text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>

                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem asChild>
                              <Link href={`/dashboard/posts/${row.slug}/edit`}>
                                Edit post
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/dashboard/posts/${row.slug}`}
                                target="_blank"
                              >
                                Preview post
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link
                                href={getPostPublicPathByType(row.type, row.slug)}
                                target="_blank"
                              >
                                Open public page
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => {
                                toast.info("Delete action is disabled here.");
                              }}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              {selectedRows.size} of {visibleRows.length} row(s) selected.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Label htmlFor="rows-per-page">Rows per page</Label>
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) => {
                    setPageSize(Number(value));
                    setPageIndex(0);
                  }}
                >
                  <SelectTrigger id="rows-per-page" size="sm" className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent side="top">
                    {[10, 20, 30, 40, 50].map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <p className="text-sm font-medium">
                Page {safePageIndex + 1} of {totalPages}
              </p>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPageIndex(0)}
                  disabled={safePageIndex === 0}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPageIndex((prev) => Math.max(0, prev - 1))}
                  disabled={safePageIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() =>
                    setPageIndex((prev) => Math.min(totalPages - 1, prev + 1))
                  }
                  disabled={safePageIndex >= totalPages - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPageIndex(totalPages - 1)}
                  disabled={safePageIndex >= totalPages - 1}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Showing {rangeStart}-{rangeEnd} of {visibleRows.length} rows.
          </p>
        </TabsContent>
      </Tabs>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/dashboard/posts"
          className="group rounded-xl border bg-white p-4 transition hover:bg-slate-50"
        >
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
            <FileText className="h-4 w-4" />
          </div>
          <p className="text-sm font-semibold text-slate-900">Posts</p>
          <p className="mt-1 text-sm text-slate-600">
            <NumberTicker
              value={stats.posts.total}
              className="tracking-normal text-current dark:text-current"
            />{" "}
            entries
          </p>
        </Link>

        <Link
          href="/dashboard/comments"
          className="group rounded-xl border bg-white p-4 transition hover:bg-slate-50"
        >
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <MessageSquare className="h-4 w-4" />
          </div>
          <p className="text-sm font-semibold text-slate-900">Comments</p>
          <p className="mt-1 text-sm text-slate-600">
            <NumberTicker
              value={stats.comments.pending}
              className="tracking-normal text-current dark:text-current"
            />{" "}
            pending review
          </p>
        </Link>

        <Link
          href="/dashboard/users"
          className="group rounded-xl border bg-white p-4 transition hover:bg-slate-50"
        >
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <Users className="h-4 w-4" />
          </div>
          <p className="text-sm font-semibold text-slate-900">Users</p>
          <p className="mt-1 text-sm text-slate-600">
            <NumberTicker
              value={stats.users.total}
              className="tracking-normal text-current dark:text-current"
            />{" "}
            total accounts
          </p>
        </Link>

        <Link
          href="/dashboard/posts/new"
          className="group rounded-xl border bg-white p-4 transition hover:bg-slate-50"
        >
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <Plus className="h-4 w-4" />
          </div>
          <p className="text-sm font-semibold text-slate-900">Create</p>
          <p className="mt-1 text-sm text-slate-600">
            Start a new post section
          </p>
        </Link>
      </section>
    </div>
  );
}
