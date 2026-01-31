"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { activitiesApi, Activity } from "@/lib/api-client";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Textarea from "@/components/ui/Textarea";
import ImageUpload from "@/components/ui/ImageUpload";
import LexicalEditor from "@/components/editor/LexicalEditor";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { toast } from "@/lib/utils/toast";

export default function EditActivityPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    content: "",
    featured_image: "",
    hero_image: "",
    icon: "",
    display_order: "0",
    is_active: true,
  });

  useEffect(() => {
    loadActivity();
  }, [slug]);

  const loadActivity = async () => {
    try {
      const data = await activitiesApi.getBySlug(slug);
      setActivity(data);
      setFormData({
        name: data.name,
        description: data.description || "",
        content: data.content || "",
        featured_image: data.featured_image || "",
        hero_image: data.hero_image || "",
        icon: data.icon || "",
        display_order: data.display_order.toString(),
        is_active: data.is_active,
      });
    } catch (error) {
      toast.error("Failed to load activity");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name) {
      toast.error("Activity name is required");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/activities/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          content: formData.content || null,
          featured_image: formData.featured_image || null,
          hero_image: formData.hero_image || null,
          icon: formData.icon || null,
          display_order: parseInt(formData.display_order) || 0,
          is_active: formData.is_active,
        }),
      });

      if (!response.ok) throw new Error("Failed to update activity");

      toast.success("Activity updated successfully");
      router.push("/dashboard/activities");
    } catch (error: any) {
      toast.error(error.message || "Failed to update activity");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/dashboard/activities"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Activities
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Edit Activity</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <Input
                label="Activity Name"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Enter activity name"
              />
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <Textarea
                label="Short Description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Brief description of the activity"
                rows={3}
              />
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Detailed Content
              </label>
              <LexicalEditor
                initialContent={formData.content}
                onChange={(html) => setFormData({ ...formData, content: html })}
                placeholder="Write detailed activity information..."
              />
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Hero Image</h3>
              <p className="text-sm text-gray-600 mb-4">
                Large banner image for activity detail pages
              </p>
              <ImageUpload
                value={formData.hero_image}
                onChange={(url) =>
                  setFormData({ ...formData, hero_image: url })
                }
                onRemove={() => setFormData({ ...formData, hero_image: "" })}
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <Input
                label="Icon (Emoji or Text)"
                value={formData.icon}
                onChange={(e) =>
                  setFormData({ ...formData, icon: e.target.value })
                }
                placeholder="🏔️ or simple text"
                helperText="Use emoji or short text (e.g., 🏔️)"
              />
              {formData.icon && (
                <div className="mt-3 p-4 bg-gray-50 rounded-lg text-center">
                  <div className="text-4xl">{formData.icon}</div>
                  <p className="text-xs text-gray-500 mt-2">Icon Preview</p>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <Input
                label="Display Order"
                type="number"
                value={formData.display_order}
                onChange={(e) =>
                  setFormData({ ...formData, display_order: e.target.value })
                }
                helperText="Lower numbers appear first"
              />
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) =>
                    setFormData({ ...formData, is_active: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm font-medium text-gray-700">
                  Active
                </span>
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Only active activities are shown on the website
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Featured Image
              </h3>
              <p className="text-xs text-gray-500 mb-3">Card/thumbnail image</p>
              <ImageUpload
                value={formData.featured_image}
                onChange={(url) =>
                  setFormData({ ...formData, featured_image: url })
                }
                onRemove={() =>
                  setFormData({ ...formData, featured_image: "" })
                }
              />
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <Button type="submit" className="w-full" isLoading={saving}>
                Update Activity
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
