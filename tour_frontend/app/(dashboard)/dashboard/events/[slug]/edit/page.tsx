"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { eventsApi, regionsApi, Region } from "@/lib/api-client";
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

export default function EditEventPage() {
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
    event_date: "",
    event_end_date: "",
    region_id: "",
    is_featured: false,
  });

  const loadData = useCallback(async () => {
    try {
      const [eventData, regionsData] = await Promise.all([
        eventsApi.getBySlug(slug),
        regionsApi.list({ limit: 100 }),
      ]);

      setRegions(regionsData.data);
      setFormData({
        title: eventData.title,
        short_description: eventData.short_description || "",
        content:
          typeof eventData.content === "string"
            ? eventData.content
            : JSON.stringify(eventData.content ?? ""),
        cover_image: eventData.cover_image || "",
        event_date: eventData.event_date
          ? eventData.event_date.split("T")[0]
          : "",
        event_end_date: eventData.event_end_date
          ? eventData.event_end_date.split("T")[0]
          : "",
        region_id: eventData.region_id || "",
        is_featured: eventData.is_featured,
      });
    } catch (error) {
      toast.error("Failed to load event");
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

    if (!formData.title || !formData.event_date) {
      toast.error("Title and event date are required");
      return;
    }

    setSaving(true);
    try {
      const response = await apiFetch(`/api/events/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          short_description: formData.short_description || null,
          content: formData.content || null,
          cover_image: formData.cover_image || null,
          event_date: formData.event_date || null,
          event_end_date: formData.event_end_date || null,
          region_id: formData.region_id || null,
          is_featured: formData.is_featured,
        }),
      });

      if (!response.ok) throw new Error("Failed to update event");

      toast.success("Event updated successfully");
      router.push("/dashboard/events");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to update event";
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
          href="/dashboard/events"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Events
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Edit Event</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <DashboardCard>
              <Input
                label="Event Title"
                required
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="Enter event title"
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
                placeholder="Brief description of the event"
                rows={3}
              />
            </DashboardCard>

            <NotionEditorField
              initialContent={formData.content}
              onChange={(html) => setFormData({ ...formData, content: html })}
              placeholder="Write detailed event information..."
            />

            <DashboardCard>
              <h3 className="text-lg font-semibold mb-4">Date</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Event Date"
                  type="date"
                  required
                  value={formData.event_date}
                  onChange={(e) =>
                    setFormData({ ...formData, event_date: e.target.value })
                  }
                />
                <Input
                  label="End Date"
                  type="date"
                  value={formData.event_end_date}
                  onChange={(e) =>
                    setFormData({ ...formData, event_end_date: e.target.value })
                  }
                />
              </div>
            </DashboardCard>
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
                    setFormData({ ...formData, is_featured: e.target.checked })
                  }
                />
                <span className="ml-2 text-sm font-medium text-gray-700">
                  Featured Event
                </span>
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Featured events appear prominently on the homepage
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
                Update Event
              </Button>
            </DashboardCard>
          </div>
        </div>
      </form>
    </div>
  );
}
