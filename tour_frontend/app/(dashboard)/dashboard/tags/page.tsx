"use client";

import { useState } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Tags as TagsIcon,
  Hash,
  FileText,
} from "lucide-react";
import type { TagWithCount, CreateTagInput } from "@/lib/api-client";
import {
  useListTagsQuery,
  useCreateTagMutation,
  useUpdateTagMutation,
  useDeleteTagMutation,
} from "@/lib/store";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Pagination from "@/components/ui/Pagination";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Modal from "@/components/ui/Modal";
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
import { toast } from "@/lib/utils/toast";

export default function TagsPage() {
  // ── Local UI state ──────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    tag: TagWithCount | null;
  }>({ open: false, tag: null });
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState<{
    open: boolean;
    tag: TagWithCount | null;
  }>({ open: false, tag: null });
  const [formData, setFormData] = useState<CreateTagInput>({
    name: "",
    tag_type: "general",
  });

  // ── RTK Query hooks ─────────────────────────────────────────────────────
  //
  // `useListTagsQuery` automatically:
  //   - Fetches data on mount and when params change
  //   - Caches results (deduplicates identical requests)
  //   - Refetches when the browser tab regains focus
  //   - Refetches when cache tags are invalidated by mutations
  //
  // No more manual `useEffect` + `useState` + `loadTags()` pattern!
  const {
    data: tagsResponse,
    isLoading,
    isFetching,
  } = useListTagsQuery(
    {
      page: currentPage,
      limit: 30,
      tag_type: typeFilter !== "all" ? typeFilter : undefined,
    },
    {
      refetchOnMountOrArgChange: true,
      refetchOnFocus: true,
    },
  );

  // Mutations — each returns a trigger function and a result object.
  // When a mutation succeeds, RTK Query automatically invalidates the
  // relevant cache tags, causing `useListTagsQuery` to refetch.
  // No more manual `loadTags()` calls after every mutation!
  const [createTag, { isLoading: creating }] = useCreateTagMutation();
  const [updateTag, { isLoading: updating }] = useUpdateTagMutation();
  const [deleteTag, { isLoading: deleting }] = useDeleteTagMutation();

  // ── Derived data ────────────────────────────────────────────────────────
  const tags = tagsResponse?.data ?? [];
  const totalPages = tagsResponse?.total_pages ?? 1;
  const total = tagsResponse?.total ?? 0;

  const saving = creating || updating;

  // Client-side search filter (instant, no network request)
  const filteredTags = tags.filter((tag) =>
    searchQuery
      ? tag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tag.slug.toLowerCase().includes(searchQuery.toLowerCase())
      : true,
  );

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteDialog.tag) return;

    try {
      await deleteTag(deleteDialog.tag.id).unwrap();
      toast.success("Tag deleted successfully");
      setDeleteDialog({ open: false, tag: null });
    } catch {
      toast.error("Failed to delete tag");
    }
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error("Tag name is required");
      return;
    }

    try {
      await createTag(formData).unwrap();
      toast.success("Tag created successfully");
      setCreateModal(false);
      resetForm();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to create tag";
      toast.error(message);
    }
  };

  const handleUpdate = async () => {
    if (!editModal.tag) return;
    if (!formData.name.trim()) {
      toast.error("Tag name is required");
      return;
    }

    try {
      await updateTag({ id: editModal.tag.id, data: formData }).unwrap();
      toast.success("Tag updated successfully");
      setEditModal({ open: false, tag: null });
      resetForm();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update tag";
      toast.error(message);
    }
  };

  const openEditModal = (tag: TagWithCount) => {
    setFormData({
      name: tag.name,
      tag_type: tag.tag_type,
    });
    setEditModal({ open: true, tag });
  };

  const resetForm = () => {
    setFormData({
      name: "",
      tag_type: "general",
    });
  };

  // ── Helpers ─────────────────────────────────────────────────────────────

  const getTypeBadge = (tagType: string) => {
    switch (tagType) {
      case "activity":
        return "bg-emerald-100 text-emerald-800";
      case "category":
        return "bg-blue-100 text-blue-800";
      case "general":
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const tagForm = (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tag Name *
        </label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g. Trekking, Photography, Budget Travel"
        />
        <p className="text-xs text-gray-500 mt-1">
          The slug will be generated automatically from the name.
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tag Type
        </label>
        <Select
          value={formData.tag_type || "general"}
          onValueChange={(value) =>
            setFormData({ ...formData, tag_type: value })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="General" />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="general">General</SelectItem>
            <SelectItem value="activity">Activity</SelectItem>
            <SelectItem value="category">Category</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500 mt-1">
          Tag type helps organize tags into groups. &quot;General&quot; is
          suitable for most tags.
        </p>
      </div>
    </div>
  );

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tags</h1>
          <p className="text-gray-600 mt-1">
            Manage tags for organizing content ({total} total)
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setCreateModal(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          New Tag
        </Button>
      </div>

      <div className="mb-6">
        <div className="border-b border-zinc-200 bg-zinc-50/70 p-4 sm:p-5 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
          <Select
            value={typeFilter}
            onValueChange={(value) => {
              setTypeFilter(value);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="min-w-[150px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="activity">Activity</SelectItem>
              <SelectItem value="category">Category</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Show a subtle loading indicator when refetching in the background */}
        {isFetching && !isLoading && (
          <div className="h-0.5 bg-blue-100 overflow-hidden">
            <div className="h-full bg-blue-500 animate-pulse w-full" />
          </div>
        )}

        {isLoading ? (
          <LoadingSpinner />
        ) : filteredTags.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <TagsIcon className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium mb-1">No tags found</p>
            <p className="text-sm">
              {searchQuery
                ? `No tags match "${searchQuery}"`
                : "Create your first tag to start organizing content."}
            </p>
            {!searchQuery && (
              <Button
                className="mt-4"
                onClick={() => {
                  resetForm();
                  setCreateModal(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Tag
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-lg border bg-white">
              <div className="overflow-x-auto">
                <Table className="table-fixed">
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-[32%]">Tag</TableHead>
                      <TableHead className="w-[24%]">Slug</TableHead>
                      <TableHead className="w-[14%]">Type</TableHead>
                      <TableHead className="w-[12%]">Content Count</TableHead>
                      <TableHead className="w-[12%]">Created</TableHead>
                      <TableHead className="w-[10%] text-right">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTags.map((tag) => (
                      <TableRow key={tag.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Hash className="w-4 h-4 text-gray-400" />
                            <span className="truncate text-sm font-medium text-gray-900">
                              {tag.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <span className="text-xs text-slate-500 font-mono">
                            {tag.slug}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs font-semibold rounded-full capitalize ${getTypeBadge(tag.tag_type)}`}
                          >
                            {tag.tag_type}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums text-slate-600">
                          <div className="flex items-center gap-1 text-sm text-gray-500">
                            <FileText className="w-4 h-4" />
                            {tag.content_count}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-slate-600">
                          {new Date(tag.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditModal(tag)}
                              title="Edit tag"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setDeleteDialog({ open: true, tag })
                              }
                              title="Delete tag"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="p-4 border-t">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Tag usage info */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>How tags work:</strong> Tags can be assigned to posts, videos,
          photos, and hotels. They help users discover related content across
          your site. Use &quot;Activity&quot; type for activity-specific tags
          (e.g. Trekking, Rafting), &quot;Category&quot; for content categories,
          and &quot;General&quot; for everything else.
        </p>
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={createModal}
        onClose={() => setCreateModal(false)}
        title="Create New Tag"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Creating..." : "Create Tag"}
            </Button>
          </div>
        }
      >
        {tagForm}
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={editModal.open}
        onClose={() => setEditModal({ open: false, tag: null })}
        title="Edit Tag"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setEditModal({ open: false, tag: null })}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        }
      >
        {tagForm}
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, tag: null })}
        onConfirm={handleDelete}
        title="Delete Tag"
        message={`Are you sure you want to delete the tag "${deleteDialog.tag?.name}"? This will remove it from all associated content. This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleting}
      />
    </div>
  );
}
