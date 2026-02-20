"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Search,
  Shield,
  ShieldCheck,
  ShieldX,
  UserCheck,
  UserX,
  Trash2,
  Ban,
  CheckCircle,
} from "lucide-react";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Select from "@/components/ui/select";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Pagination from "@/components/ui/Pagination";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/lib/utils/toast";
import { apiFetch } from "@/lib/csrf";

interface UserItem {
  id: string;
  email: string;
  email_verified: boolean;
  name: string | null;
  image: string | null;
  role: string;
  is_active: boolean;
  banned_at: string | null;
  created_at: string;
  updated_at: string;
}

interface PaginatedUsers {
  data: UserItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

type DialogAction = {
  open: boolean;
  user: UserItem | null;
  action: "activate" | "deactivate" | "block" | "unblock" | "delete" | null;
};

export default function UsersManagement() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionDialog, setActionDialog] = useState<DialogAction>({
    open: false,
    user: null,
    action: null,
  });
  const [processing, setProcessing] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(currentPage));
      params.set("limit", "20");
      if (roleFilter !== "all") params.set("role", roleFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const res = await fetch(`/api/users?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load users");
      const data: PaginatedUsers = await res.json();
      setUsers(data.data);
      setTotalPages(data.total_pages);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [currentPage, roleFilter, statusFilter, searchQuery]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleAction = async () => {
    if (!actionDialog.user || !actionDialog.action) return;
    setProcessing(true);
    try {
      const { user, action } = actionDialog;
      let url = "";
      let method = "POST";

      switch (action) {
        case "activate":
          url = `/api/users/${user.id}/activate`;
          break;
        case "deactivate":
          url = `/api/users/${user.id}/deactivate`;
          break;
        case "block":
          url = `/api/users/${user.id}/block`;
          break;
        case "unblock":
          url = `/api/users/${user.id}/unblock`;
          break;
        case "delete":
          url = `/api/users/${user.id}`;
          method = "DELETE";
          break;
      }

      const res = await apiFetch(url, { method });
      if (!res.ok) throw new Error(`Failed to ${action} user`);

      toast.success(
        `User ${action === "delete" ? "deleted" : action + "d"} successfully`,
      );
      setActionDialog({ open: false, user: null, action: null });
      loadUsers();
    } catch {
      toast.error(`Failed to perform action`);
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (user: UserItem) => {
    if (user.banned_at) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
          <Ban className="h-3 w-3" />
          Blocked
        </span>
      );
    }
    if (user.is_active) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
          <CheckCircle className="h-3 w-3" />
          Active
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
        <UserX className="h-3 w-3" />
        Pending
      </span>
    );
  };

  const getRoleBadge = (role: string) => {
    if (role === "admin") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
          <ShieldCheck className="h-3 w-3" />
          Admin
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
        <Shield className="h-3 w-3" />
        Editor
      </span>
    );
  };

  const dialogMessage = () => {
    if (!actionDialog.user || !actionDialog.action) return "";
    const name = actionDialog.user.name || actionDialog.user.email;
    switch (actionDialog.action) {
      case "activate":
        return `Activate ${name}'s account? They will be able to create content.`;
      case "deactivate":
        return `Deactivate ${name}'s account? They will not be able to create content.`;
      case "block":
        return `Block ${name}? They will be logged out and unable to access the platform.`;
      case "unblock":
        return `Unblock ${name}? Their account will be reactivated.`;
      case "delete":
        return `Permanently delete ${name}'s account? This cannot be undone.`;
    }
  };

  return (
    <div>
      {/* Filters */}
      <div className="mb-6 flex flex-row flex-wrap items-end gap-3 justify-between w-full">
        <div className="relative w-full max-w-[300px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-10"
          />
        </div>
        <div className="flex flex-row gap-3 ">
          <Select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setCurrentPage(1);
            }}
            options={[
              { value: "all", label: "All Roles" },
              { value: "admin", label: "Admin" },
              { value: "editor", label: "Editor" },
            ]}
            className="min-w-[150px]"
          />
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            options={[
              { value: "all", label: "All Status" },
              { value: "active", label: "Active" },
              { value: "pending", label: "Pending" },
              { value: "blocked", label: "Blocked" },
            ]}
            className="min-w-[150px]"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <LoadingSpinner />
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white py-20 text-center">
          <p className="text-gray-500">No users found</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white">
          <div className="overflow-x-auto">
            <Table className="table-fixed">
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-[42%]">User</TableHead>
                  <TableHead className="w-[14%]">Role</TableHead>
                  <TableHead className="w-[14%]">Status</TableHead>
                  <TableHead className="w-[14%]">Joined</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {user.image ? (
                          <img
                            src={user.image}
                            alt=""
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-600">
                            {(user.name || user.email).charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900">
                            {user.name || "No name"}
                          </p>
                          <p className="truncate text-xs text-gray-500">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                    <TableCell>{getStatusBadge(user)}</TableCell>
                    <TableCell className="text-slate-600">
                      {new Date(user.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {user.role !== "admin" && (
                          <>
                            {user.banned_at ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setActionDialog({
                                    open: true,
                                    user,
                                    action: "unblock",
                                  })
                                }
                                title="Unblock"
                              >
                                <UserCheck className="h-4 w-4" />
                              </Button>
                            ) : (
                              <>
                                {user.is_active ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      setActionDialog({
                                        open: true,
                                        user,
                                        action: "deactivate",
                                      })
                                    }
                                    title="Deactivate"
                                  >
                                    <ShieldX className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      setActionDialog({
                                        open: true,
                                        user,
                                        action: "activate",
                                      })
                                    }
                                    title="Activate"
                                  >
                                    <UserCheck className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    setActionDialog({
                                      open: true,
                                      user,
                                      action: "block",
                                    })
                                  }
                                  title="Block"
                                >
                                  <Ban className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setActionDialog({
                                  open: true,
                                  user,
                                  action: "delete",
                                })
                              }
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={actionDialog.open}
        title={`${actionDialog.action ? actionDialog.action.charAt(0).toUpperCase() + actionDialog.action.slice(1) : ""} User`}
        message={dialogMessage()}
        confirmLabel={
          actionDialog.action
            ? actionDialog.action.charAt(0).toUpperCase() +
              actionDialog.action.slice(1)
            : "Confirm"
        }
        variant={
          actionDialog.action === "delete" || actionDialog.action === "block"
            ? "danger"
            : "primary"
        }
        isLoading={processing}
        onConfirm={handleAction}
        onClose={() =>
          setActionDialog({ open: false, user: null, action: null })
        }
      />
    </div>
  );
}
