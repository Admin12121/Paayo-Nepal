"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/csrf";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Select from "@/components/ui/select";
import Textarea from "@/components/ui/Textarea";
import Checkbox from "@/components/ui/checkbox";
import ImageUpload from "@/components/ui/ImageUpload";
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

export default function NewRegionPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    cover_image: "",
    is_featured: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name) {
      toast.error("Region name is required");
      return;
    }

    setSaving(true);
    try {
      const response = await apiFetch("/api/regions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          cover_image: formData.cover_image || null,
          is_featured: formData.is_featured,
        }),
      });

      if (!response.ok) throw new Error("Failed to create region");

      toast.success("Region created successfully");
      router.push("/dashboard/regions");
    } catch (error: any) {
      toast.error(error.message || "Failed to create region");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

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
        <h1 className="text-3xl font-bold text-gray-900">Create New Region</h1>
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
                Create Region
              </Button>
            </DashboardCard>
          </div>
        </div>
      </form>
    </div>
  );
}
