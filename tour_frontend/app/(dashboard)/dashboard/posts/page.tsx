"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Eye,
  CheckCircle,
} from "lucide-react";
import { postsApi, Post, PaginatedResponse } from "@/lib/api-client";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Select from "@/components/ui/Select";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Pagination from "@/components/ui/Pagination";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { toast } from "@/lib/utils/toast";

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    post: Post | null;
  }>({
    open: false,
    post: null,
  });
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadPosts();
  }, [currentPage, statusFilter, typeFilter]);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const params: any = { page: currentPage, limit: 20 };
      if (statusFilter !== "all") params.status = statusFilter;
      if (typeFilter !== "all") params.type = typeFilter;

      const response = await postsApi.list(params);
      setPosts(response.data);
      setTotalPages(response.total_pages);
    } catch (error) {
      toast.error("Failed to load posts");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.post) return;

    setDeleting(true);
    try {
      await postsApi.delete(deleteDialog.post.slug);
      toast.success("Post deleted successfully");
      setDeleteDialog({ open: false, post: null });
      loadPosts();
    } catch (error) {
      toast.error("Failed to delete post");
      console.error(error);
    } finally {
      setDeleting(false);
    }
  };

  const handleApprove = async (post: Post) => {
    try {
      await postsApi.approve(post.id);
      toast.success("Post approved successfully");
      loadPosts();
    } catch (error) {
      toast.error("Failed to approve post");
      console.error(error);
    }
  };

  const handlePublish = async (post: Post) => {
    try {
      await postsApi.publish(post.id);
      toast.success("Post published successfully");
      loadPosts();
    } catch (error) {
      toast.error("Failed to publish post");
      console.error(error);
    }
  };

  const filteredPosts = posts.filter((post) =>
    searchQuery
      ? post.title.toLowerCase().includes(searchQuery.toLowerCase())
      : true,
  );

  const getStatusBadge = (status: string) => {
    const styles = {
      draft: "bg-gray-100 text-gray-800",
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-green-100 text-green-800",
      published: "bg-blue-100 text-blue-800",
    };
    return styles[status as keyof typeof styles] || styles.draft;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Posts</h1>
          <p className="text-gray-600 mt-1">
            Manage your blog posts and articles
          </p>
        </div>
        <Link href="/dashboard/posts/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Post
          </Button>
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-4 border-b flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search posts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: "all", label: "All Status" },
              { value: "draft", label: "Draft" },
              { value: "pending", label: "Pending" },
              { value: "approved", label: "Approved" },
              { value: "published", label: "Published" },
            ]}
            className="min-w-[150px]"
          />
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            options={[
              { value: "all", label: "All Types" },
              { value: "article", label: "Article" },
              { value: "guide", label: "Guide" },
              { value: "news", label: "News" },
            ]}
            className="min-w-[150px]"
          />
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>No posts found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Views
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPosts.map((post) => (
                  <tr key={post.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        {post.featured_image && (
                          <img
                            src={post.featured_image}
                            alt={post.title}
                            className="w-12 h-12 object-cover rounded mr-3"
                          />
                        )}
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {post.title}
                          </div>
                          <div className="text-sm text-gray-500">
                            /{post.slug}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900 capitalize">
                        {post.post_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(
                          post.status,
                        )}`}
                      >
                        {post.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <Eye className="w-4 h-4 mr-1" />
                        {post.views}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(post.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        {post.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleApprove(post)}
                            title="Approve"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        )}
                        <Link href={`/dashboard/posts/${post.slug}/edit`}>
                          <Button variant="ghost" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteDialog({ open: true, post })}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="p-4 border-t">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, post: null })}
        onConfirm={handleDelete}
        title="Delete Post"
        message={`Are you sure you want to delete "${deleteDialog.post?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleting}
      />
    </div>
  );
}
