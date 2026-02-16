"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { regionsApi, Region } from "@/lib/api-client";
import { apiFetch } from "@/lib/csrf";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import Checkbox from "@/components/ui/Checkbox";
import ImageUpload from "@/components/ui/ImageUpload";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import DashboardCard from "@/components/dashboard/DashboardCard";
import { toast } from "@/lib/utils/toast";

const PROVINCES = [
  "Koshi",
  "Madhesh",
  "Bagmati",
  "Gandaki",
  "Lumbini",
  "Karnali",
  "Sudurpashchim",
];

export default function EditRegionPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [region, setRegion] = useState<Region | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    cover_image: "",
    is_featured: false,
  });

  useEffect(() => {
    loadRegion();
  }, [slug]);

  const loadRegion = async () => {
    try {
      const data = await regionsApi.getBySlug(slug);
      setRegion(data);
      setFormData({
        name: data.name,
        description: data.description || "",
        cover_image: data.cover_image || "",
        is_featured: data.is_featured,
      });
    } catch (error) {
      toast.error("Failed to load region");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name) {
      toast.error("Region name is required");
      return;
    }

    setSaving(true);
    try {
      const response = await apiFetch(`/api/regions/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          cover_image: formData.cover_image || null,
          is_featured: formData.is_featured,
        }),
      });

      if (!response.ok) throw new Error("Failed to update region");

      toast.success("Region updated successfully");
      router.push("/dashboard/regions");
    } catch (error: any) {
      toast.error(error.message || "Failed to update region");
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
          href="/dashboard/regions"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Regions
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Edit Region</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <DashboardCard contentClassName="p-6">
              <Input
                label="Region Name"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Enter region name"
              />
            </DashboardCard>

            <DashboardCard contentClassName="p-6">
              <Textarea
                label="Description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Brief description of the region"
                rows={5}
              />
            </DashboardCard>
          </div>

          <div className="space-y-6">
            <DashboardCard contentClassName="p-6">
              <label className="flex items-center">
                <Checkbox
                  checked={formData.is_featured}
                  onChange={(e) =>
                    setFormData({ ...formData, is_featured: e.target.checked })
                  }
                />
                <span className="ml-2 text-sm font-medium text-gray-700">
                  Featured Region
                </span>
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Featured regions are highlighted on the website
              </p>
            </DashboardCard>

            <DashboardCard contentClassName="p-6">
              <ImageUpload
                label="Cover Image"
                value={formData.cover_image}
                onChange={(url) =>
                  setFormData({ ...formData, cover_image: url })
                }
                onRemove={() => setFormData({ ...formData, cover_image: "" })}
              />
            </DashboardCard>

            <DashboardCard contentClassName="p-6">
              <Button type="submit" className="w-full" isLoading={saving}>
                Update Region
              </Button>
            </DashboardCard>
          </div>
        </div>
      </form>
    </div>
  );
}
