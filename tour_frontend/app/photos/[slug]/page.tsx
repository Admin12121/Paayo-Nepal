"use client";

import { useState, useEffect } from "react";
import { useParams, notFound } from "next/navigation";
import {
  Eye,
  Camera,
  Calendar,
  Heart,
  ChevronLeft,
  ChevronRight,
  X,
  Star,
} from "lucide-react";
import { photoFeaturesApi, PhotoFeature, PhotoImage } from "@/lib/api-client";
import Link from "next/link";
import { useViewTracker } from "@/lib/hooks/use-view-tracker";
import { LikeButton } from "@/components/ui/LikeButton";
import { CommentSection } from "@/components/ui/CommentSection";
import { ShareButtons } from "@/components/ui/ShareButtons";

function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="flex items-center gap-2 text-sm text-gray-600 mb-6">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          {item.href ? (
            <Link
              href={item.href}
              className="hover:text-[#0078C0] transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-[#0078C0] font-medium">{item.label}</span>
          )}
          {index < items.length - 1 && <span>/</span>}
        </div>
      ))}
    </nav>
  );
}

function RelatedPhotoCard({ photo }: { photo: PhotoFeature }) {
  const coverImage =
    photo.images && photo.images.length > 0 ? photo.images[0].image_url : null;
  const imageCount = photo.images ? photo.images.length : 0;

  return (
    <Link href={`/photos/${photo.slug}`}>
      <div className="group cursor-pointer">
        <div className="rounded-[10px] overflow-hidden aspect-[4/3] mb-2 relative bg-gray-200">
          {coverImage ? (
            <img
              src={coverImage}
              alt={photo.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
              <Camera className="w-8 h-8 text-gray-300" />
            </div>
          )}
          {imageCount > 0 && (
            <div className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-xs font-medium px-1.5 py-0.5 rounded flex items-center gap-1">
              <Camera className="w-3 h-3" />
              {imageCount}
            </div>
          )}
          {photo.is_featured && (
            <div className="absolute top-1.5 right-1.5 bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded text-xs font-bold flex items-center gap-0.5">
              <Star className="w-3 h-3 fill-current" />
            </div>
          )}
        </div>
        <div className="flex items-center justify-between text-xs text-[#868383] mb-1">
          <span>
            {new Date(
              photo.published_at || photo.created_at,
            ).toLocaleDateString()}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="w-3 h-3" />
            {photo.view_count}
          </span>
        </div>
        <h4 className="font-display text-sm font-semibold text-[#1A2B49] leading-snug line-clamp-2 group-hover:text-[#0078C0] transition-colors">
          {photo.title}
        </h4>
      </div>
    </Link>
  );
}

function LightboxModal({
  images,
  currentIndex,
  onClose,
  onPrev,
  onNext,
  onGoTo,
}: {
  images: PhotoImage[];
  currentIndex: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onGoTo: (index: number) => void;
}) {
  const image = images[currentIndex];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onPrev, onNext]);

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
        aria-label="Close lightbox"
      >
        <X className="w-5 h-5 text-white" />
      </button>

      {/* Counter */}
      <div className="absolute top-4 left-4 z-10 text-white/70 text-sm font-medium">
        {currentIndex + 1} / {images.length}
      </div>

      {/* Previous button */}
      {images.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
          aria-label="Previous image"
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
      )}

      {/* Next button */}
      {images.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
          aria-label="Next image"
        >
          <ChevronRight className="w-6 h-6 text-white" />
        </button>
      )}

      {/* Image */}
      <div
        className="max-w-[90vw] max-h-[85vh] flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={image.image_url}
          alt={image.caption || `Photo ${currentIndex + 1}`}
          className="max-w-full max-h-[80vh] object-contain rounded-lg"
        />
        {image.caption && (
          <p className="text-white/80 text-sm mt-3 text-center max-w-xl">
            {image.caption}
          </p>
        )}
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 max-w-[90vw] overflow-x-auto px-4 py-2">
          {images.map((img, idx) => (
            <button
              key={img.id}
              onClick={(e) => {
                e.stopPropagation();
                onGoTo(idx);
              }}
              className={`w-14 h-14 rounded-md overflow-hidden flex-shrink-0 border-2 transition-all ${
                idx === currentIndex
                  ? "border-white opacity-100"
                  : "border-transparent opacity-50 hover:opacity-80"
              }`}
            >
              <img
                src={img.image_url}
                alt={img.caption || `Thumbnail ${idx + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PhotoDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [photo, setPhoto] = useState<PhotoFeature | null>(null);
  const [images, setImages] = useState<PhotoImage[]>([]);
  const [relatedPhotos, setRelatedPhotos] = useState<PhotoFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Track the page view once the photo feature is loaded
  useViewTracker("photo", photo?.id);

  useEffect(() => {
    if (slug) {
      fetchPhoto();
      fetchRelatedPhotos();
    }
  }, [slug]);

  const fetchPhoto = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await photoFeaturesApi.getBySlug(slug);
      setPhoto(data);

      // Fetch images for this photo feature
      if (data.images && data.images.length > 0) {
        // Images came with the response (eager loaded)
        const sorted = [...data.images].sort(
          (a, b) => a.display_order - b.display_order,
        );
        setImages(sorted);
      } else {
        // Fetch images separately
        try {
          const imgs = await photoFeaturesApi.listImages(data.id);
          const sorted = [...imgs].sort(
            (a, b) => a.display_order - b.display_order,
          );
          setImages(sorted);
        } catch {
          setImages([]);
        }
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to load photo feature",
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedPhotos = async () => {
    try {
      const response = await photoFeaturesApi.list({
        limit: 6,
        status: "published",
      });
      setRelatedPhotos(response.data.filter((p) => p.slug !== slug));
    } catch (err) {
      console.error("Failed to fetch related photos:", err);
    }
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
  };

  const closeLightbox = () => {
    setLightboxIndex(null);
  };

  const prevImage = () => {
    setLightboxIndex((prev) =>
      prev !== null ? (prev - 1 + images.length) % images.length : null,
    );
  };

  const nextImage = () => {
    setLightboxIndex((prev) =>
      prev !== null ? (prev + 1) % images.length : null,
    );
  };

  const goToImage = (index: number) => {
    setLightboxIndex(index);
  };

  if (loading) {
    return (
      <div className="bg-[#F8F9FA] min-h-screen pt-20">
        <div className="max-w-[1400px] mx-auto px-6 py-10">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-6" />
            <div className="h-12 bg-gray-200 rounded w-3/4 mb-4" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <div className="aspect-[4/3] bg-gray-200 rounded-2xl col-span-2 row-span-2" />
              <div className="aspect-[4/3] bg-gray-200 rounded-2xl" />
              <div className="aspect-[4/3] bg-gray-200 rounded-2xl" />
            </div>
            <div className="h-6 bg-gray-200 rounded w-full mb-2" />
            <div className="h-6 bg-gray-200 rounded w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !photo) {
    notFound();
  }

  return (
    <div className="bg-[#F8F9FA] min-h-screen pt-20">
      <div className="max-w-[1400px] mx-auto px-6 py-10">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Photos", href: "/photos" },
            { label: photo.title },
          ]}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Photo Header */}
            <div className="mb-6">
              <div className="flex items-start justify-between gap-4 mb-3">
                <h1 className="font-display text-3xl md:text-4xl font-semibold text-[#1A2B49] leading-tight">
                  {photo.title}
                </h1>
                {photo.is_featured && (
                  <div className="flex items-center gap-1 bg-yellow-50 text-yellow-700 px-3 py-1.5 rounded-full text-xs font-bold flex-shrink-0">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    Featured
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3 text-sm text-[#868383]">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {new Date(
                      photo.published_at || photo.created_at,
                    ).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Camera className="w-4 h-4" />
                    {images.length} {images.length === 1 ? "photo" : "photos"}
                  </span>
                </div>
                <ShareButtons
                  title={photo.title}
                  description={photo.description || undefined}
                  compact
                />
              </div>
            </div>

            {/* Photo Gallery */}
            {images.length > 0 ? (
              <div className="mb-6">
                {/* Hero image (first image, large) */}
                {images.length === 1 ? (
                  <div
                    className="rounded-2xl overflow-hidden cursor-pointer group"
                    onClick={() => openLightbox(0)}
                  >
                    <div className="relative aspect-[16/10] bg-gray-200">
                      <img
                        src={images[0].image_url}
                        alt={images[0].caption || photo.title}
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                    </div>
                    {images[0].caption && (
                      <p className="text-sm text-gray-500 mt-2 italic">
                        {images[0].caption}
                      </p>
                    )}
                  </div>
                ) : images.length === 2 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {images.map((img, idx) => (
                      <div
                        key={img.id}
                        className="rounded-2xl overflow-hidden cursor-pointer group"
                        onClick={() => openLightbox(idx)}
                      >
                        <div className="relative aspect-[4/3] bg-gray-200">
                          <img
                            src={img.image_url}
                            alt={img.caption || `${photo.title} - ${idx + 1}`}
                            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* 3+ images: mosaic layout */
                  <div className="grid grid-cols-3 grid-rows-2 gap-3 auto-rows-[200px]">
                    {/* First image takes up 2 columns and 2 rows */}
                    <div
                      className="col-span-2 row-span-2 rounded-2xl overflow-hidden cursor-pointer group relative"
                      onClick={() => openLightbox(0)}
                    >
                      <div className="relative w-full h-full bg-gray-200">
                        <img
                          src={images[0].image_url}
                          alt={images[0].caption || photo.title}
                          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                      </div>
                    </div>

                    {/* Second image */}
                    <div
                      className="rounded-2xl overflow-hidden cursor-pointer group relative"
                      onClick={() => openLightbox(1)}
                    >
                      <div className="relative w-full h-full bg-gray-200">
                        <img
                          src={images[1].image_url}
                          alt={images[1].caption || `${photo.title} - 2`}
                          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                      </div>
                    </div>

                    {/* Third image (or "+N more" overlay) */}
                    <div
                      className="rounded-2xl overflow-hidden cursor-pointer group relative"
                      onClick={() => openLightbox(2)}
                    >
                      <div className="relative w-full h-full bg-gray-200">
                        <img
                          src={images[2].image_url}
                          alt={images[2].caption || `${photo.title} - 3`}
                          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                        {images.length > 3 && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <span className="text-white text-2xl font-bold">
                              +{images.length - 3} more
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Full thumbnail strip for 4+ images */}
                {images.length > 3 && (
                  <div className="mt-4">
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {images.map((img, idx) => (
                        <button
                          key={img.id}
                          onClick={() => openLightbox(idx)}
                          className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 border-2 border-transparent hover:border-[#0078C0] transition-all opacity-80 hover:opacity-100"
                        >
                          <img
                            src={img.image_url}
                            alt={
                              img.caption ||
                              `${photo.title} thumbnail ${idx + 1}`
                            }
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mb-6 bg-gray-100 rounded-2xl aspect-[16/10] flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <Camera className="w-16 h-16 mx-auto mb-3" />
                  <p className="text-lg font-medium">
                    No photos in this collection yet
                  </p>
                </div>
              </div>
            )}

            {/* Description */}
            {photo.description && (
              <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm mb-6">
                <h3 className="font-display text-lg font-bold text-[#1A2B49] mb-3">
                  About this Collection
                </h3>
                <div className="text-[#4B5563] leading-relaxed whitespace-pre-wrap">
                  {photo.description}
                </div>
              </div>
            )}

            {/* Engagement Stats */}
            <div className="flex items-center justify-between flex-wrap gap-4 py-4 border-t border-b border-gray-200 mb-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-[#868383] text-sm">
                  <Eye className="w-4 h-4" />
                  <span className="font-medium">
                    {photo.view_count.toLocaleString()} views
                  </span>
                </div>
                <LikeButton
                  targetType="photo"
                  targetId={photo.id}
                  initialCount={photo.like_count}
                  size="sm"
                />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-sm text-[#868383]">
                  <Camera className="w-4 h-4" />
                  <span>
                    {images.length} {images.length === 1 ? "photo" : "photos"}
                  </span>
                </div>
                <ShareButtons
                  title={photo.title}
                  description={photo.description || undefined}
                  compact
                />
              </div>
            </div>

            {/* All images with captions (scrollable gallery view) */}
            {images.length > 1 && (
              <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm mb-6">
                <h3 className="font-display text-lg font-bold text-[#1A2B49] mb-4 flex items-center gap-2">
                  <Camera className="w-5 h-5 text-[#0078C0]" />
                  All Photos ({images.length})
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {images.map((img, idx) => (
                    <div
                      key={img.id}
                      className="group cursor-pointer"
                      onClick={() => openLightbox(idx)}
                    >
                      <div className="aspect-square rounded-xl overflow-hidden bg-gray-100 relative">
                        <img
                          src={img.image_url}
                          alt={img.caption || `${photo.title} - ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                          <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Camera className="w-4 h-4 text-gray-900" />
                          </div>
                        </div>
                      </div>
                      {img.caption && (
                        <p className="text-xs text-gray-500 mt-1.5 line-clamp-1">
                          {img.caption}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Comments Section */}
            <div className="mt-6">
              <CommentSection targetType="photo" targetId={photo.id} />
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* Quick Stats Card */}
            <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
              <h3 className="font-display text-lg font-bold text-[#1A2B49] mb-4">
                Collection Info
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-2">
                    <Camera className="w-4 h-4" />
                    Photos
                  </span>
                  <span className="font-semibold text-[#1A2B49]">
                    {images.length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    Views
                  </span>
                  <span className="font-semibold text-[#1A2B49]">
                    {photo.view_count.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-2">
                    <Heart className="w-4 h-4" />
                    Likes
                  </span>
                  <span className="font-semibold text-[#1A2B49]">
                    {photo.like_count.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Published
                  </span>
                  <span className="font-semibold text-[#1A2B49]">
                    {new Date(
                      photo.published_at || photo.created_at,
                    ).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>
            </div>

            {/* Share card */}
            <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
              <h3 className="font-display text-lg font-bold text-[#1A2B49] mb-4">
                Share this collection
              </h3>
              <ShareButtons
                title={photo.title}
                description={photo.description || undefined}
              />
            </div>

            {/* Related Photo Features */}
            {relatedPhotos.length > 0 && (
              <>
                <h3 className="font-display text-lg font-bold text-[#1A2B49] mb-6 uppercase tracking-wide">
                  MORE PHOTO FEATURES
                </h3>
                <div className="space-y-6">
                  {relatedPhotos.slice(0, 5).map((p) => (
                    <RelatedPhotoCard key={p.id} photo={p} />
                  ))}
                </div>
                {relatedPhotos.length > 5 && (
                  <Link
                    href="/photos"
                    className="block mt-6 text-center text-[#0078C0] font-semibold hover:text-[#0068A0] transition-colors"
                  >
                    View All Photos →
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && images.length > 0 && (
        <LightboxModal
          images={images}
          currentIndex={lightboxIndex}
          onClose={closeLightbox}
          onPrev={prevImage}
          onNext={nextImage}
          onGoTo={goToImage}
        />
      )}
    </div>
  );
}
