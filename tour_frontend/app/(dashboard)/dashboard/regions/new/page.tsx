"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import ImageUpload from "@/components/ui/ImageUpload";
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
    featured_image: "",
    latitude: "",
    longitude: "",
    province: "",
    district: "",
    display_order: "0",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name) {
      toast.error("Region name is required");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/regions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          latitude: formData.latitude ? parseFloat(formData.latitude) : null,
          longitude: formData.longitude ? parseFloat(formData.longitude) : null,
          display_order: parseInt(formData.display_order) || 0,
          province: formData.province || null,
          district: formData.district || null,
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
            <div className="bg-white rounded-lg shadow p-6">
              <Input
                label="Region Name"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Enter region name"
              />
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <Textarea
                label="Description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Brief description of the region"
                rows={5}
              />
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Location</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Province"
                  value={formData.province}
                  onChange={(e) =>
                    setFormData({ ...formData, province: e.target.value })
                  }
                  options={[
                    { value: "", label: "Select province..." },
                    ...PROVINCES.map((p) => ({ value: p, label: p })),
                  ]}
                />
                <Input
                  label="District"
                  value={formData.district}
                  onChange={(e) =>
                    setFormData({ ...formData, district: e.target.value })
                  }
                  placeholder="District name"
                />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Coordinates</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Latitude"
                  type="number"
                  step="any"
                  value={formData.latitude}
                  onChange={(e) =>
                    setFormData({ ...formData, latitude: e.target.value })
                  }
                  placeholder="27.7172"
                  helperText="Decimal format (e.g., 27.7172)"
                />
                <Input
                  label="Longitude"
                  type="number"
                  step="any"
                  value={formData.longitude}
                  onChange={(e) =>
                    setFormData({ ...formData, longitude: e.target.value })
                  }
                  placeholder="85.3240"
                  helperText="Decimal format (e.g., 85.3240)"
                />
              </div>
              <p className="text-sm text-gray-500 mt-2">
                You can use{" "}
                <a
                  href="https://www.latlong.net/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  LatLong.net
                </a>{" "}
                to find coordinates
              </p>
            </div>
          </div>

          <div className="space-y-6">
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

            <div className="bg-white rounded-lg shadow p-6">
              <Button type="submit" className="w-full" isLoading={saving}>
                Create Region
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
