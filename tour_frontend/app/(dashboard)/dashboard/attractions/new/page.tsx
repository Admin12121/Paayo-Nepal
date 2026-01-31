"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { regionsApi, Region } from "@/lib/api-client";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import ImageUpload from "@/components/ui/ImageUpload";
import LexicalEditor from "@/components/editor/LexicalEditor";
import { toast } from "@/lib/utils/toast";

const DEFAULT_HOURS = {
  monday: { open: "09:00", close: "17:00" },
  tuesday: { open: "09:00", close: "17:00" },
  wednesday: { open: "09:00", close: "17:00" },
  thursday: { open: "09:00", close: "17:00" },
  friday: { open: "09:00", close: "17:00" },
  saturday: { open: "09:00", close: "17:00" },
  sunday: { open: "09:00", close: "17:00" },
};

export default function NewAttractionPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [regions, setRegions] = useState<Region[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    content: "",
    featured_image: "",
    region_id: "",
    latitude: "",
    longitude: "",
    address: "",
    entry_fee: "",
    is_top_attraction: false,
    opening_hours: JSON.stringify(DEFAULT_HOURS, null, 2),
  });

  useEffect(() => {
    loadRegions();
  }, []);

  const loadRegions = async () => {
    try {
      const response = await regionsApi.list({ limit: 100 });
      setRegions(response.data);
    } catch (error) {
      console.error("Failed to load regions:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name) {
      toast.error("Attraction name is required");
      return;
    }

    // Validate JSON
    let openingHours = null;
    if (formData.opening_hours.trim()) {
      try {
        openingHours = JSON.parse(formData.opening_hours);
      } catch {
        toast.error("Invalid JSON format for opening hours");
        return;
      }
    }

    setSaving(true);
    try {
      const response = await fetch("/api/attractions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          content: formData.content || null,
          featured_image: formData.featured_image || null,
          region_id: formData.region_id || null,
          latitude: formData.latitude ? parseFloat(formData.latitude) : null,
          longitude: formData.longitude ? parseFloat(formData.longitude) : null,
          address: formData.address || null,
          entry_fee: formData.entry_fee || null,
          is_top_attraction: formData.is_top_attraction,
          opening_hours: openingHours,
        }),
      });

      if (!response.ok) throw new Error("Failed to create attraction");

      toast.success("Attraction created successfully");
      router.push("/dashboard/attractions");
    } catch (error: any) {
      toast.error(error.message || "Failed to create attraction");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

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
        <h1 className="text-3xl font-bold text-gray-900">
          Create New Attraction
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <Input
                label="Attraction Name"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Enter attraction name"
              />
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <Textarea
                label="Short Description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Brief description of the attraction"
                rows={3}
              />
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Detailed Content
              </label>
              <LexicalEditor
                onChange={(html) => setFormData({ ...formData, content: html })}
                placeholder="Write detailed attraction information..."
              />
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Location Details</h3>
              <div className="space-y-4">
                <Input
                  label="Address"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  placeholder="Street address or location description"
                />
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
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-2">
                Opening Hours (JSON)
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Edit the JSON below to set opening hours for each day of the
                week
              </p>
              <Textarea
                value={formData.opening_hours}
                onChange={(e) =>
                  setFormData({ ...formData, opening_hours: e.target.value })
                }
                rows={12}
                className="font-mono text-sm"
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
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
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <Input
                label="Entry Fee"
                value={formData.entry_fee}
                onChange={(e) =>
                  setFormData({ ...formData, entry_fee: e.target.value })
                }
                placeholder="e.g., NPR 500, Free"
              />
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_top_attraction}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      is_top_attraction: e.target.checked,
                    })
                  }
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm font-medium text-gray-700">
                  Top Attraction
                </span>
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Featured prominently on the website
              </p>
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
                Create Attraction
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
