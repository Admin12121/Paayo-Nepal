"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/csrf";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Textarea from "@/components/ui/Textarea";
import Checkbox from "@/components/ui/checkbox";
import ImageUpload from "@/components/ui/ImageUpload";
import NotionEditorField from "@/components/editor/NotionEditorField";
import DashboardCard from "@/components/dashboard/DashboardCard";
import { toast } from "@/lib/utils/toast";

export default function NewActivityPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    short_description: "",
    content: "",
    cover_image: "",
    icon: "",
    is_featured: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title) {
      toast.error("Activity name is required");
      return;
    }

    setSaving(true);
    try {
      const response = await apiFetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          short_description: formData.short_description || null,
          content: formData.content || null,
          cover_image: formData.cover_image || null,
          is_featured: formData.is_featured,
        }),
      });

      if (!response.ok) throw new Error("Failed to create activity");

      toast.success("Activity created successfully");
      router.push("/dashboard/activities");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to create activity";
      toast.error(message);
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

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
        <h1 className="text-3xl font-bold text-gray-900">
          Create New Activity
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <DashboardCard>
              <Input
                label="Activity Name"
                required
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="Enter activity name"
              />
            </DashboardCard>

            <DashboardCard>
              <Textarea
                label="Short Description"
                value={formData.short_description}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    short_description: e.target.value,
                  })
                }
                placeholder="Brief description of the activity"
                rows={3}
              />
            </DashboardCard>

            <NotionEditorField
              onChange={(html) => setFormData({ ...formData, content: html })}
              placeholder="Write detailed activity information..."
            />
          </div>

          <div className="space-y-6">
            <DashboardCard>
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
            </DashboardCard>

            <DashboardCard>
              <label className="flex items-center">
                <Checkbox
                  checked={formData.is_featured}
                  onChange={(e) =>
                    setFormData({ ...formData, is_featured: e.target.checked })
                  }
                />
                <span className="ml-2 text-sm font-medium text-gray-700">
                  Featured
                </span>
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Featured activities are highlighted on the website
              </p>
            </DashboardCard>

            <DashboardCard>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Cover Image
              </h3>
              <p className="text-xs text-gray-500 mb-3">Card/thumbnail image</p>
              <ImageUpload
                value={formData.cover_image}
                onChange={(url) =>
                  setFormData({ ...formData, cover_image: url })
                }
                onRemove={() => setFormData({ ...formData, cover_image: "" })}
              />
            </DashboardCard>

            <DashboardCard>
              <Button type="submit" className="w-full" isLoading={saving}>
                Create Activity
              </Button>
            </DashboardCard>
          </div>
        </div>
      </form>
    </div>
  );
}
