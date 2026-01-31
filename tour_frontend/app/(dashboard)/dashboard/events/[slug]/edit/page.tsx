"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { eventsApi, Event, regionsApi, Region } from "@/lib/api-client";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import ImageUpload from "@/components/ui/ImageUpload";
import LexicalEditor from "@/components/editor/LexicalEditor";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { toast } from "@/lib/utils/toast";

export default function EditEventPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regions, setRegions] = useState<Region[]>([]);
  const [event, setEvent] = useState<Event | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    content: "",
    featured_image: "",
    start_date: "",
    end_date: "",
    start_time: "",
    end_time: "",
    location: "",
    region_id: "",
    is_featured: false,
  });

  useEffect(() => {
    loadData();
  }, [slug]);

  const loadData = async () => {
    try {
      const [eventData, regionsData] = await Promise.all([
        eventsApi.getBySlug(slug),
        regionsApi.list({ limit: 100 }),
      ]);

      setEvent(eventData);
      setRegions(regionsData.data);
      setFormData({
        title: eventData.title,
        description: eventData.description || "",
        content: eventData.content || "",
        featured_image: eventData.featured_image || "",
        start_date: eventData.start_date.split("T")[0],
        end_date: eventData.end_date ? eventData.end_date.split("T")[0] : "",
        start_time: eventData.start_time || "",
        end_time: eventData.end_time || "",
        location: eventData.location || "",
        region_id: eventData.region_id || "",
        is_featured: eventData.is_featured,
      });
    } catch (error) {
      toast.error("Failed to load event");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.start_date) {
      toast.error("Title and start date are required");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/events/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          region_id: formData.region_id || null,
          end_date: formData.end_date || null,
          start_time: formData.start_time || null,
          end_time: formData.end_time || null,
        }),
      });

      if (!response.ok) throw new Error("Failed to update event");

      toast.success("Event updated successfully");
      router.push("/dashboard/events");
    } catch (error: any) {
      toast.error(error.message || "Failed to update event");
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
            <div className="bg-white rounded-lg shadow p-6">
              <Input
                label="Event Title"
                required
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="Enter event title"
              />
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <Textarea
                label="Short Description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Brief description of the event"
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
                placeholder="Write detailed event information..."
              />
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Date & Time</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Start Date"
                  type="date"
                  required
                  value={formData.start_date}
                  onChange={(e) =>
                    setFormData({ ...formData, start_date: e.target.value })
                  }
                />
                <Input
                  label="End Date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) =>
                    setFormData({ ...formData, end_date: e.target.value })
                  }
                />
                <Input
                  label="Start Time"
                  type="time"
                  value={formData.start_time}
                  onChange={(e) =>
                    setFormData({ ...formData, start_time: e.target.value })
                  }
                />
                <Input
                  label="End Time"
                  type="time"
                  value={formData.end_time}
                  onChange={(e) =>
                    setFormData({ ...formData, end_time: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <Input
                label="Location"
                value={formData.location}
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
                placeholder="Event venue or location"
              />
            </div>

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
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_featured}
                  onChange={(e) =>
                    setFormData({ ...formData, is_featured: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm font-medium text-gray-700">
                  Featured Event
                </span>
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Featured events appear prominently on the homepage
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
                Update Event
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
