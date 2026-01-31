"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { postsApi } from "@/lib/api-client";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import ImageUpload from "@/components/ui/ImageUpload";
import LexicalEditor from "@/components/editor/LexicalEditor";
import { toast } from "@/lib/utils/toast";

export default function NewPostPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    excerpt: "",
    content: "",
    featured_image: "",
    post_type: "article",
    tags: "",
    meta_title: "",
    meta_description: "",
  });

  const handleSubmit = async (e: React.FormEvent, publish = false) => {
    e.preventDefault();

    if (!formData.title || !formData.content) {
      toast.error("Title and content are required");
      return;
    }

    setSaving(true);
    try {
      const tags = formData.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);

      const postData = {
        title: formData.title,
        excerpt: formData.excerpt || undefined,
        content: formData.content,
        featured_image: formData.featured_image || undefined,
        post_type: formData.post_type,
        tags: tags.length > 0 ? tags : undefined,
        meta_title: formData.meta_title || undefined,
        meta_description: formData.meta_description || undefined,
      };

      const post = await postsApi.create(postData);

      if (publish) {
        await postsApi.publish(post.id);
        toast.success("Post published successfully");
      } else {
        toast.success("Post saved as draft");
      }

      router.push("/dashboard/posts");
    } catch (error: any) {
      toast.error(error.message || "Failed to save post");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/dashboard/posts"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Posts
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Create New Post</h1>
      </div>

      <form onSubmit={(e) => handleSubmit(e, false)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <Input
                label="Title"
                required
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="Enter post title"
              />
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <Textarea
                label="Excerpt"
                value={formData.excerpt}
                onChange={(e) =>
                  setFormData({ ...formData, excerpt: e.target.value })
                }
                placeholder="Brief description of the post"
                rows={3}
              />
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Content <span className="text-red-500">*</span>
              </label>
              <LexicalEditor
                onChange={(html) => setFormData({ ...formData, content: html })}
                placeholder="Write your post content..."
              />
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">SEO Settings</h3>
              <div className="space-y-4">
                <Input
                  label="Meta Title"
                  value={formData.meta_title}
                  onChange={(e) =>
                    setFormData({ ...formData, meta_title: e.target.value })
                  }
                  placeholder="SEO title (optional)"
                />
                <Textarea
                  label="Meta Description"
                  value={formData.meta_description}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      meta_description: e.target.value,
                    })
                  }
                  placeholder="SEO description (optional)"
                  rows={3}
                />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <Select
                label="Post Type"
                required
                value={formData.post_type}
                onChange={(e) =>
                  setFormData({ ...formData, post_type: e.target.value })
                }
                options={[
                  { value: "article", label: "Article" },
                  { value: "guide", label: "Guide" },
                  { value: "news", label: "News" },
                  { value: "review", label: "Review" },
                ]}
              />
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <Input
                label="Tags"
                value={formData.tags}
                onChange={(e) =>
                  setFormData({ ...formData, tags: e.target.value })
                }
                placeholder="comma, separated, tags"
                helperText="Separate tags with commas"
              />
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <ImageUpload
                label="Featured Image"
                value={formData.featured_image}
                onChange={(url) =>
                  setFormData({ ...formData, featured_image: url })
                }
                onRemove={() =>
                  setFormData({ ...formData, featured_image: "" })
                }
              />
            </div>

            <div className="bg-white rounded-lg shadow p-6 space-y-3">
              <Button type="submit" className="w-full" isLoading={saving}>
                Save Draft
              </Button>
              <Button
                type="button"
                variant="primary"
                className="w-full"
                onClick={(e) => handleSubmit(e as any, true)}
                isLoading={saving}
              >
                Publish Now
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
