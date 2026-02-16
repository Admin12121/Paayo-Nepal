"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { attractionsApi, regionsApi, Region } from "@/lib/api-client";
import { apiFetch } from "@/lib/csrf";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import Checkbox from "@/components/ui/Checkbox";
import ImageUpload from "@/components/ui/ImageUpload";
import NotionEditorField from "@/components/editor/NotionEditorField";
import DashboardCard from "@/components/dashboard/DashboardCard";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { toast } from "@/lib/utils/toast";

export default function EditAttractionPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regions, setRegions] = useState<Region[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    short_description: "",
    content: "",
    cover_image: "",
    region_id: "",
    is_featured: false,
  });

  const loadData = useCallback(async () => {
    try {
      const [attractionData, regionsData] = await Promise.all([
        attractionsApi.getBySlug(slug),
        regionsApi.list({ limit: 100 }),
      ]);

      setRegions(regionsData.data);
      setFormData({
        title: attractionData.title,
        short_description: attractionData.short_description || "",
        content:
          typeof attractionData.content === "string"
            ? attractionData.content
            : JSON.stringify(attractionData.content ?? ""),
        cover_image: attractionData.cover_image || "",
        region_id: attractionData.region_id || "",
        is_featured: attractionData.is_featured,
      });
    } catch (error) {
      toast.error("Failed to load attraction");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title) {
      toast.error("Attraction name is required");
      return;
    }

    setSaving(true);
    try {
      const response = await apiFetch(`/api/attractions/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          short_description: formData.short_description || null,
          content: formData.content || null,
          cover_image: formData.cover_image || null,
          region_id: formData.region_id || null,
          is_featured: formData.is_featured,
        }),
      });

      if (!response.ok) throw new Error("Failed to update attraction");

      toast.success("Attraction updated successfully");
      router.push("/dashboard/attractions");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to update attraction";
      toast.error(message);
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
          href="/dashboard/attractions"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Attractions
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Edit Attraction</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <DashboardCard>
              <Input
                label="Attraction Name"
                required
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="Enter attraction name"
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
                placeholder="Brief description of the attraction"
                rows={3}
              />
            </DashboardCard>

            <NotionEditorField
              initialContent={formData.content}
              onChange={(html) => setFormData({ ...formData, content: html })}
              placeholder="Write detailed attraction information..."
            />
          </div>

          <div className="space-y-6">
            <DashboardCard>
              <Select
                label="Region"
                value={formData.region_id}
                onChange={(e) =>
                  setFormData({ ...formData, region_id: e.target.value })
                }
                options={[
                  { value: "", label: "Select region..." },
                  ...regions.map((r) => ({ value: r.id, label: r.name })),
                ]}
              />
            </DashboardCard>

            <DashboardCard>
              <label className="flex items-center">
                <Checkbox
                  checked={formData.is_featured}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      is_featured: e.target.checked,
                    })
                  }
                />
                <span className="ml-2 text-sm font-medium text-gray-700">
                  Featured Attraction
                </span>
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Featured prominently on the website
              </p>
            </DashboardCard>

            <DashboardCard>
              <ImageUpload
                label="Cover Image"
                value={formData.cover_image}
                onChange={(url) =>
                  setFormData({ ...formData, cover_image: url })
                }
                onRemove={() => setFormData({ ...formData, cover_image: "" })}
              />
            </DashboardCard>

            <DashboardCard>
              <Button type="submit" className="w-full" isLoading={saving}>
                Update Attraction
              </Button>
            </DashboardCard>
          </div>
        </div>
      </form>
    </div>
  );
}
