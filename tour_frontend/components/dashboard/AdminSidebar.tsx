"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ComponentType } from "react";
import {
  Activity,
  Calendar,
  Camera,
  Compass,
  FileText,
  Home,
  Hotel,
  Image as ImageIcon,
  LayoutDashboard,
  Lock,
  LogOut,
  MapPin,
  MessageSquare,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  Tags,
  Users,
  UserRound,
  Video,
  ChevronsUpDown,
} from "lucide-react";
import {
  IconBolt,
  IconCoin,
  IconLogout,
  IconUserCircle,
  IconLoader2,
  IconRosetteDiscountCheck,
  IconSparkles,
  IconMoon,
  IconSun,
  IconDeviceDesktop,
} from "@tabler/icons-react";
import { signOutAndClear } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { IconCirclePlusFilled, type Icon } from "@tabler/icons-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTheme } from "next-themes";

interface NavItem {
  name: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  requiresActive?: boolean;
}

interface SidebarUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

const contentItems: NavItem[] = [
  {
    name: "Posts",
    href: "/dashboard/posts",
    icon: FileText,
    requiresActive: true,
  },
  {
    name: "Media",
    href: "/dashboard/media",
    icon: ImageIcon,
    requiresActive: true,
  },
  {
    name: "Events",
    href: "/dashboard/events",
    icon: Calendar,
    requiresActive: true,
  },
  {
    name: "Regions",
    href: "/dashboard/regions",
    icon: MapPin,
    requiresActive: true,
  },
  {
    name: "Attractions",
    href: "/dashboard/attractions",
    icon: Compass,
    requiresActive: true,
  },
  {
    name: "Activities",
    href: "/dashboard/activities",
    icon: Activity,
    requiresActive: true,
  },
  {
    name: "Videos",
    href: "/dashboard/videos",
    icon: Video,
    requiresActive: true,
  },
  {
    name: "Hotels",
    href: "/dashboard/hotels",
    icon: Hotel,
    requiresActive: true,
  },
  {
    name: "Photos",
    href: "/dashboard/photos",
    icon: Camera,
    requiresActive: true,
  },
];

const managementItems: NavItem[] = [
  {
    name: "Comments",
    href: "/dashboard/comments",
    icon: MessageSquare,
    adminOnly: true,
  },
  {
    name: "Hero Slides",
    href: "/dashboard/hero-slides",
    icon: SlidersHorizontal,
    adminOnly: true,
  },
  { name: "Tags", href: "/dashboard/tags", icon: Tags, adminOnly: true },
  { name: "Users", href: "/dashboard/users", icon: Users, adminOnly: true },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

function SectionTitle({
  title,
  accentClassName,
}: {
  title: string;
  accentClassName: string;
}) {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <span className={cn("h-1.5 w-1.5 rounded-full", accentClassName)} />
      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        {title}
      </p>
    </div>
  );
}

function NavList({
  items,
  pathname,
  userRole,
  isActive,
}: {
  items: NavItem[];
  pathname: string | null;
  userRole: string;
  isActive: boolean;
}) {
  return (
    <SidebarMenu className="gap-1.5">
      {items
        .filter((item) => !item.adminOnly || userRole === "admin")
        .map((item) => {
          const isCurrentPage =
            pathname === item.href || pathname?.startsWith(`${item.href}/`);
          const isDisabled = item.requiresActive && !isActive;
          const Icon = item.icon;

          if (isDisabled) {
            return (
              <SidebarMenuItem key={item.href}>
                <div
                  className="flex h-9 items-center gap-2 rounded-md px-2.5 text-sm text-zinc-400 opacity-70"
                  title="Account activation required"
                >
                  <Icon className="h-4 w-4" />
                  <span className="truncate">{item.name}</span>
                  <Lock className="ml-auto h-3.5 w-3.5" />
                </div>
              </SidebarMenuItem>
            );
          }

          return (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={isCurrentPage}
                tooltip={item.name}
                className={cn(
                  "h-9 rounded-md px-2.5 font-medium",
                  isCurrentPage
                    ? "bg-blue-600 text-white hover:bg-blue-600 hover:text-white"
                    : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900",
                )}
              >
                <Link href={item.href}>
                  <Icon className="h-4 w-4" />
                  <span>{item.name}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
    </SidebarMenu>
  );
}

function getInitials(name: string | null | undefined): string {
  const value = (name || "User").trim();
  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const isThemeReady =
    theme === "light" || theme === "dark" || theme === "system";

  if (!isThemeReady) {
    return (
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2 text-sm">
          <IconSun size={16} className="text-muted-foreground" />
          <span>Theme</span>
        </div>
        <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/50 p-0.5">
          <div className="h-6 w-6" />
          <div className="h-6 w-6" />
          <div className="h-6 w-6" />
        </div>
      </div>
    );
  }

  const options = [
    { value: "dark", icon: IconMoon, label: "Dark" },
    { value: "light", icon: IconSun, label: "Light" },
    { value: "system", icon: IconDeviceDesktop, label: "System" },
  ] as const;

  return (
    <div className="flex items-center justify-between px-2 py-1.5">
      <div className="flex items-center gap-2 text-sm">
        <IconSun size={16} className="text-muted-foreground" />
        <span>Theme</span>
      </div>
      <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/50 p-0.5">
        {options.map(({ value, icon: Icon, label }) => {
          const isActive = theme === value;
          return (
            <button
              key={value}
              type="button"
              title={label}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setTheme(value);
              }}
              className={`flex h-6 w-6 items-center justify-center rounded-md transition-all ${
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={14} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminSidebar({
  userRole,
  isActive,
  user = {},
}: {
  userRole: string;
  isActive: boolean;
  user?: SidebarUser;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleSignOut = async () => {
    setIsLoggingOut(true);
    try {
      await signOutAndClear();
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Sign out failed:", error);
      setIsLoggingOut(false);
    }
  };

  return (
    <Sidebar
      collapsible="offcanvas"
      className="border-r border-zinc-200/80 bg-white"
    >
      <SidebarHeader className="px-2 pb-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link href="/">
                <span className="text-base font-semibold cooper">
                  Paayo Nepal.
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="px-1 py-2">
        {userRole === "editor" && !isActive && (
          <SidebarGroup className="pt-1 pb-3">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="mb-1 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
                <p className="text-xs font-semibold text-amber-800">
                  Pending Approval
                </p>
              </div>
              <p className="text-xs text-amber-700">
                Content creation is disabled until an admin activates your
                account.
              </p>
            </div>
          </SidebarGroup>
        )}

        <SidebarGroup className="pt-1">
          <SidebarGroupContent className="flex flex-col gap-2">
            <SidebarMenu>
              <SidebarMenuItem className="flex items-center gap-2">
                <SidebarMenuButton
                  asChild
                  tooltip="Dashboard"
                  isActive={pathname === "/dashboard"}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground min-w-8 duration-200 ease-linear"
                >
                  <Link href="/dashboard">
                    <IconCirclePlusFilled />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>

            <SidebarGroupLabel>
              <div className="mt-5 flex items-center gap-3.5 pl-2 pb-2">
                <div className="w-4.5 h-0.5 rounded-xs bg-red-600"></div>
                <p className="text-stone-400 font-medium text-xs uppercase font-mono grow">
                  Content
                </p>
              </div>
            </SidebarGroupLabel>

            <NavList
              items={contentItems}
              pathname={pathname}
              userRole={userRole}
              isActive={isActive}
            />
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="pt-2">
          <SidebarGroupLabel>
            <div className="flex items-center gap-3.5 pl-2 pb-2">
              <div className="w-4.5 h-0.5 rounded-xs bg-amber-400"></div>
              <p className="text-stone-400 font-medium text-xs uppercase font-mono grow">
                Security Suite
              </p>
            </div>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <NavList
              items={managementItems}
              pathname={pathname}
              userRole={userRole}
              isActive={isActive}
            />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="relative">
                <Avatar className="h-8 w-8 rounded-lg grayscale">
                  <AvatarImage
                    src={user.image ?? undefined}
                    alt={user.name ?? undefined}
                  />
                  <AvatarFallback className="rounded-lg">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-medium">
                    {user.name || "User"}
                  </span>
                </div>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={"bottom"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 p-2 text-left text-sm bg-muted rounded-lg mb-3">
                <div className="relative">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage
                      src={user.image ?? undefined}
                      alt={user.name ?? undefined}
                    />
                    <AvatarFallback className="rounded-lg">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="grid flex-1 text-left text-lg leading-tight">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium cooper">
                      {user.name || "User"}
                    </span>
                  </div>
                  <span className="text-muted-foreground truncate text-xs">
                    {user.email || ""}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuGroup className="space-y-1">
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => router.push("/dashboard/account")}
              >
                <IconUserCircle />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => router.push("/dashboard/settings")}
              >
                <Settings />
                Settings
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuItem
              onClick={handleSignOut}
              disabled={isLoggingOut}
              className="cursor-pointer"
            >
              {isLoggingOut ? (
                <IconLoader2 className="animate-spin" />
              ) : (
                <IconLogout />
              )}
              {isLoggingOut ? "Signing out..." : "Log out"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <ThemeSwitcher />
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
