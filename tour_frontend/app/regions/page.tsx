"use client";

import { useMemo, useEffect, useState } from "react";
import { MapPin, Filter } from "lucide-react";
import { regionsApi, Region } from "@/lib/api-client";
import Image from "next/image";
import Link from "next/link";

function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="mb-5 flex items-center gap-2 text-xs text-[#6A7898]">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          {item.href ? (
            <Link href={item.href} className="transition-colors hover:text-[#0078C0]">
              {item.label}
            </Link>
          ) : (
            <span className="font-semibold text-[#0078C0]">{item.label}</span>
          )}
          {index < items.length - 1 && <span>/</span>}
        </div>
      ))}
    </nav>
  );
}

function RegionCard({ region }: { region: Region }) {
  return (
    <Link href={`/regions/${region.slug}`}>
      <article className="group relative h-[340px] overflow-hidden rounded-2xl bg-white shadow-[0_8px_22px_rgba(12,36,66,0.11)]">
        {region.cover_image ? (
          <Image
            src={region.cover_image}
            alt={region.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-[#D9DEE8]">
            <MapPin className="h-12 w-12 text-[#95A4BF]" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[rgba(12,32,59,0.85)]" />

        <div className="absolute bottom-0 left-0 right-0 p-5">
          <div className="mb-2 flex items-center gap-2">
            {region.province ? (
              <span className="rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.07em] text-white backdrop-blur-sm">
                {region.province}
              </span>
            ) : null}
            {region.district ? (
              <span className="text-[11px] text-white/80">{region.district}</span>
            ) : null}
          </div>

          <h3 className="font-display text-[30px] font-semibold leading-tight text-white">
            {region.name}
          </h3>
        </div>
      </article>
    </Link>
  );
}

function RegionCardSkeleton() {
  return <div className="h-[340px] animate-pulse rounded-2xl bg-[#DDE3EE]" />;
}

export default function RegionsPage() {
  const [allRegions, setAllRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvince, setSelectedProvince] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  const limit = 12;

  useEffect(() => {
    const fetchRegions = async () => {
      try {
        setLoading(true);
        const response = await regionsApi.list({ limit: 200, status: "published" });
        setAllRegions(response.data);
      } catch (err) {
        console.error("Failed to load regions:", err);
        setAllRegions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRegions();
  }, []);

  const provinces = useMemo(
    () =>
      Array.from(new Set(allRegions.map((r) => r.province).filter(Boolean))).sort() as string[],
    [allRegions],
  );

  const filteredRegions = useMemo(() => {
    if (selectedProvince === "all") return allRegions;
    return allRegions.filter((region) => region.province === selectedProvince);
  }, [allRegions, selectedProvince]);

  const totalPages = Math.max(1, Math.ceil(filteredRegions.length / limit));
  const pagedRegions = useMemo(() => {
    const start = (currentPage - 1) * limit;
    return filteredRegions.slice(start, start + limit);
  }, [filteredRegions, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const handleProvinceChange = (province: string) => {
    setSelectedProvince(province);
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen bg-[#EEF1F6] pt-20">
      <div className="mx-auto max-w-[1240px] px-6 py-8">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Regions" }]} />

        <div className="mb-7">
          <h1 className="font-display text-[40px] font-semibold text-[#1A2B49] md:text-[46px]">
            Explore by Regions
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-[#6A7898] md:text-base">
            Discover landscapes, culture, and attractions across Nepal&apos;s provinces.
          </p>
        </div>

        <div className="mb-7 rounded-2xl bg-white p-5 shadow-[0_5px_20px_rgba(14,35,63,0.08)]">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-[#47597A]">
              <Filter className="h-4 w-4" />
              Filter by province
            </div>

            <button
              onClick={() => handleProvinceChange("all")}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] transition-colors ${
                selectedProvince === "all"
                  ? "bg-[#0078C0] text-white"
                  : "bg-[#ECF1F8] text-[#4E6284] hover:bg-[#DFE7F2]"
              }`}
            >
              All
            </button>

            {provinces.map((province) => (
              <button
                key={province}
                onClick={() => handleProvinceChange(province)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] transition-colors ${
                  selectedProvince === province
                    ? "bg-[#0078C0] text-white"
                    : "bg-[#ECF1F8] text-[#4E6284] hover:bg-[#DFE7F2]"
                }`}
              >
                {province}
              </button>
            ))}
          </div>

          <p className="mt-3 text-xs text-[#6A7898]">
            Showing {pagedRegions.length} of {filteredRegions.length} region(s)
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <RegionCardSkeleton key={i} />
            ))}
          </div>
        ) : pagedRegions.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center">
            <h3 className="text-lg font-semibold text-[#1A2B49]">No Regions Found</h3>
            <p className="mt-1 text-sm text-[#6A7898]">No regions match this province filter.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {pagedRegions.map((region) => (
                <RegionCard key={region.id} region={region} />
              ))}
            </div>

            {totalPages > 1 ? (
              <div className="mt-10 flex items-center justify-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="rounded-md border border-[#D0D8E6] px-4 py-2 text-sm text-[#4A5D7E] disabled:opacity-40"
                >
                  Previous
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`h-9 w-9 rounded-md text-sm font-semibold ${
                      page === currentPage
                        ? "bg-[#0078C0] text-white"
                        : "text-[#4A5D7E] hover:bg-[#E7EEF7]"
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-md border border-[#D0D8E6] px-4 py-2 text-sm text-[#4A5D7E] disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
