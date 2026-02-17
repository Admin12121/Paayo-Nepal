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
import Input from "@/components/ui/input";
import Select from "@/components/ui/select";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Pagination from "@/components/ui/Pagination";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
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
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
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
        <Select
          value={roleFilter}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
            setRoleFilter(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="editor">Editor</option>
        </Select>
        <Select
          value={statusFilter}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
            setStatusFilter(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="blocked">Blocked</option>
        </Select>
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
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-700">User</th>
                <th className="px-4 py-3 font-medium text-gray-700">Role</th>
                <th className="px-4 py-3 font-medium text-gray-700">Status</th>
                <th className="px-4 py-3 font-medium text-gray-700">Joined</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
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
                      <div>
                        <p className="font-medium text-gray-900">
                          {user.name || "No name"}
                        </p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{getRoleBadge(user.role)}</td>
                  <td className="px-4 py-3">{getStatusBadge(user)}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {user.role !== "admin" && (
                        <>
                          {user.banned_at ? (
                            <button
                              onClick={() =>
                                setActionDialog({
                                  open: true,
                                  user,
                                  action: "unblock",
                                })
                              }
                              className="rounded p-1.5 text-green-600 hover:bg-green-50"
                              title="Unblock"
                            >
                              <UserCheck className="h-4 w-4" />
                            </button>
                          ) : (
                            <>
                              {user.is_active ? (
                                <button
                                  onClick={() =>
                                    setActionDialog({
                                      open: true,
                                      user,
                                      action: "deactivate",
                                    })
                                  }
                                  className="rounded p-1.5 text-amber-600 hover:bg-amber-50"
                                  title="Deactivate"
                                >
                                  <ShieldX className="h-4 w-4" />
                                </button>
                              ) : (
                                <button
                                  onClick={() =>
                                    setActionDialog({
                                      open: true,
                                      user,
                                      action: "activate",
                                    })
                                  }
                                  className="rounded p-1.5 text-green-600 hover:bg-green-50"
                                  title="Activate"
                                >
                                  <UserCheck className="h-4 w-4" />
                                </button>
                              )}
                              <button
                                onClick={() =>
                                  setActionDialog({
                                    open: true,
                                    user,
                                    action: "block",
                                  })
                                }
                                className="rounded p-1.5 text-red-600 hover:bg-red-50"
                                title="Block"
                              >
                                <Ban className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() =>
                              setActionDialog({
                                open: true,
                                user,
                                action: "delete",
                              })
                            }
                            className="rounded p-1.5 text-red-600 hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
