"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Image as ImageIcon,
  Calendar,
  MapPin,
  Compass,
  Activity,
  Users,
  Settings,
  Home,
  Lock,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
  requiresActive?: boolean;
}

const navItems: NavItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    name: "Posts",
    href: "/dashboard/posts",
    icon: <FileText className="w-5 h-5" />,
    requiresActive: true,
  },
  {
    name: "Media",
    href: "/dashboard/media",
    icon: <ImageIcon className="w-5 h-5" />,
    requiresActive: true,
  },
  {
    name: "Events",
    href: "/dashboard/events",
    icon: <Calendar className="w-5 h-5" />,
    requiresActive: true,
  },
  {
    name: "Regions",
    href: "/dashboard/regions",
    icon: <MapPin className="w-5 h-5" />,
    requiresActive: true,
  },
  {
    name: "Attractions",
    href: "/dashboard/attractions",
    icon: <Compass className="w-5 h-5" />,
    requiresActive: true,
  },
  {
    name: "Activities",
    href: "/dashboard/activities",
    icon: <Activity className="w-5 h-5" />,
    requiresActive: true,
  },
  {
    name: "Users",
    href: "/dashboard/users",
    icon: <Users className="w-5 h-5" />,
    adminOnly: true,
  },
  {
    name: "Settings",
    href: "/dashboard/settings",
    icon: <Settings className="w-5 h-5" />,
  },
];

export default function AdminSidebar({
  userRole,
  isActive,
}: {
  userRole: string;
  isActive: boolean;
}) {
  const pathname = usePathname();

  const filteredItems = navItems.filter(
    (item) => !item.adminOnly || userRole === "admin",
  );

  return (
    <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-white border-r border-gray-200 overflow-y-auto">
      <div className="p-4">
        <Link
          href="/"
          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors mb-4"
        >
          <Home className="w-5 h-5" />
          Back to Website
        </Link>

        {/* Pending approval banner for inactive editors */}
        {userRole === "editor" && !isActive && (
          <div className="mx-1 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <p className="text-xs font-semibold text-amber-800">
                Pending Approval
              </p>
            </div>
            <p className="text-xs text-amber-600">
              Content creation is disabled until an admin activates your
              account.
            </p>
          </div>
        )}

        <nav className="space-y-1">
          {filteredItems.map((item) => {
            const isCurrentPage =
              pathname === item.href || pathname?.startsWith(item.href + "/");
            const isDisabled = item.requiresActive && !isActive;

            if (isDisabled) {
              return (
                <div
                  key={item.href}
                  className="flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-lg text-gray-400 cursor-not-allowed opacity-50"
                  title="Account activation required"
                >
                  {item.icon}
                  {item.name}
                  <Lock className="w-3.5 h-3.5 ml-auto" />
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                  isCurrentPage
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-50 hover:text-gray-900",
                )}
              >
                {item.icon}
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
