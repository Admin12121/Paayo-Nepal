"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, Save, Star, StarOff, Trash2 } from "lucide-react";
import {
  useDeleteAttractionMutation,
  useGetAttractionBySlugQuery,
  useListRegionsQuery,
  useUpdateAttractionMutation,
} from "@/lib/store";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Textarea from "@/components/ui/Textarea";
import Checkbox from "@/components/ui/checkbox";
import ImageUpload from "@/components/ui/ImageUpload";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import NotionEditorField from "@/components/editor/NotionEditorField";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/lib/utils/toast";

interface AttractionFormData {
  title: string;
  short_description: string;
  content: string;
  cover_image: string;
  region_id: string;
  is_featured: boolean;
  status: string;
}

const EMPTY_FORM: AttractionFormData = {
  title: "",
  short_description: "",
  content: "",
  cover_image: "",
  region_id: "",
  is_featured: false,
  status: "draft",
};

function toEditorContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (content == null) return "";
  try {
    return JSON.stringify(content);
  } catch {
    return "";
  }
}

export default function DashboardAttractionDetailPage() {
  const params = useParams();
  const router = useRouter();

  const slugParam = params?.slug;
  const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam;

  const [formData, setFormData] = useState<AttractionFormData>(EMPTY_FORM);
  const [initializedAttractionId, setInitializedAttractionId] = useState<
    string | null
  >(null);
  const [activeAction, setActiveAction] = useState<"save" | "publish" | null>(
    null,
  );

  const {
    data: attraction,
    isLoading,
    isFetching,
    error,
    refetch: refetchAttraction,
  } = useGetAttractionBySlugQuery(slug ?? "", {
    skip: !slug,
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
  });

  const { data: regionsResponse } = useListRegionsQuery(
    { limit: 100 },
    {
      refetchOnMountOrArgChange: true,
      refetchOnFocus: true,
    },
  );
  const regions = regionsResponse?.data ?? [];

  const [updateAttraction] = useUpdateAttractionMutation();
  const [deleteAttraction, { isLoading: deleting }] = useDeleteAttractionMutation();

  useEffect(() => {
    if (!attraction) return;
    if (initializedAttractionId === attraction.id) return;

    setFormData({
      title: attraction.title,
      short_description: attraction.short_description || "",
      content: toEditorContent(attraction.content),
      cover_image: attraction.cover_image || "",
      region_id: attraction.region_id || "",
      is_featured: attraction.is_featured,
      status: attraction.status,
    });
    setInitializedAttractionId(attraction.id);
  }, [attraction, initializedAttractionId]);

  const stats = useMemo(() => {
    if (!attraction) {
      return { likes: 0, views: 0 };
    }
    return {
      likes: attraction.likes ?? attraction.like_count ?? 0,
      views: attraction.views ?? attraction.view_count ?? 0,
    };
  }, [attraction]);

  const handleSave = async () => {
    if (!attraction) return;
    if (!formData.title.trim()) {
      toast.error("Attraction name is required");
      return;
    }

    setActiveAction("save");
    try {
      const updatedAttraction = await updateAttraction({
        slug: attraction.slug,
        data: {
          title: formData.title.trim(),
          short_description: formData.short_description.trim() || null,
          content: formData.content || null,
          cover_image: formData.cover_image.trim() || null,
          region_id: formData.region_id || null,
          is_featured: formData.is_featured,
          status: formData.status,
        },
      }).unwrap();

      if (slug && updatedAttraction.slug !== slug) {
        router.replace(`/dashboard/attractions/${updatedAttraction.slug}`);
        router.refresh();
        return;
      }

      setInitializedAttractionId(null);
      await refetchAttraction();
      toast.success("Attraction updated successfully");
    } catch {
      toast.error("Failed to update attraction");
    } finally {
      setActiveAction(null);
    }
  };

  const handlePublish = async () => {
    if (!attraction) return;

    setActiveAction("publish");
    try {
      const updatedAttraction = await updateAttraction({
        slug: attraction.slug,
        data: { status: "published" },
      }).unwrap();

      if (slug && updatedAttraction.slug !== slug) {
        router.replace(`/dashboard/attractions/${updatedAttraction.slug}`);
        router.refresh();
        return;
      }

      setInitializedAttractionId(null);
      await refetchAttraction();
      toast.success("Attraction published successfully");
    } catch {
      toast.error("Failed to publish attraction");
    } finally {
      setActiveAction(null);
    }
  };

  const handleDelete = async () => {
    if (!attraction) return;
    if (
      !window.confirm(`Delete "${attraction.title}"? This action cannot be undone.`)
    ) {
      return;
    }

    try {
      await deleteAttraction(attraction.slug).unwrap();
      toast.success("Attraction deleted successfully");
      router.replace("/dashboard/attractions");
      router.refresh();
    } catch {
      toast.error("Failed to delete attraction");
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !attraction) {
    return (
      <div className="space-y-4 rounded-xl border bg-white p-8 text-center">
        <p className="text-slate-700">Attraction not found.</p>
        <div>
          <Link
            href="/dashboard/attractions"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            Back to attractions
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {isFetching && (
        <div className="h-0.5 overflow-hidden bg-blue-100">
          <div className="h-full w-full animate-pulse bg-blue-500" />
        </div>
      )}

      <section className="rounded-2xl border bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4 sm:p-5">
          <div className="min-w-0">
            <Link
              href="/dashboard/attractions"
              className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Attractions
            </Link>
            <h1 className="truncate text-2xl font-bold text-slate-900 sm:text-3xl">
              {formData.title || attraction.title}
            </h1>
            <p className="mt-1 text-xs text-blue-600">/{attraction.slug}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {attraction.status}
            </Badge>
            {attraction.is_featured ? (
              <Badge className="bg-amber-500 text-white hover:bg-amber-500">
                <Star className="mr-1 h-3 w-3 fill-current" />
                Featured
              </Badge>
            ) : (
              <Badge variant="outline" className="text-slate-600">
                <StarOff className="mr-1 h-3 w-3" />
                Standard
              </Badge>
            )}
            {attraction.status === "draft" && (
              <Button
                type="button"
                size="sm"
                onClick={handlePublish}
                isLoading={activeAction === "publish"}
              >
                <CheckCircle className="mr-1 h-4 w-4" />
                Publish
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              isLoading={activeAction === "save"}
              className="bg-slate-900 text-white hover:bg-slate-700"
            >
              <Save className="mr-1 h-4 w-4" />
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleDelete}
              isLoading={deleting}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>

        <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Attraction Name *
              </label>
              <Input
                value={formData.title}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="Attraction name"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Short Description
              </label>
              <Textarea
                rows={3}
                value={formData.short_description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    short_description: e.target.value,
                  }))
                }
                placeholder="Brief description of the attraction"
              />
            </div>

            <NotionEditorField
              initialContent={formData.content}
              onChange={(html) =>
                setFormData((prev) => ({ ...prev, content: html }))
              }
              placeholder="Write detailed attraction information..."
              label="Detailed Content"
              hint="Use headings, lists, and images to structure this page."
            />
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Region
              </label>
              <select
                value={formData.region_id}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, region_id: e.target.value }))
                }
                className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">Select region...</option>
                {regions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Cover Image
              </label>
              <ImageUpload
                label=""
                value={formData.cover_image}
                onChange={(url) =>
                  setFormData((prev) => ({ ...prev, cover_image: url }))
                }
                onRemove={() =>
                  setFormData((prev) => ({ ...prev, cover_image: "" }))
                }
                previewHeightClass="h-44"
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="attraction_is_featured"
                checked={formData.is_featured}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    is_featured: e.target.checked,
                  }))
                }
              />
              <label htmlFor="attraction_is_featured" className="text-sm text-gray-700">
                Featured attraction
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
              <div className="rounded-md bg-slate-50 p-2">
                <p className="mb-1 text-slate-500">Views</p>
                <p className="text-sm font-semibold text-slate-800">
                  {stats.views.toLocaleString()}
                </p>
              </div>
              <div className="rounded-md bg-slate-50 p-2">
                <p className="mb-1 text-slate-500">Likes</p>
                <p className="text-sm font-semibold text-slate-800">
                  {stats.likes.toLocaleString()}
                </p>
              </div>
            </div>

            <Link
              href={`/attractions/${attraction.slug}`}
              className="inline-flex text-xs text-blue-600 hover:underline"
            >
              View public page
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
