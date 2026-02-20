import { redirect } from "next/navigation";
import { photoFeaturesApi } from "@/lib/api-client";

export default async function PhotoSlugRedirectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let searchTitle = slug.replace(/-/g, " ");

  try {
    const feature = await photoFeaturesApi.getBySlug(slug);
    if (feature.title?.trim()) {
      searchTitle = feature.title.trim();
    }
  } catch {
    // Fall back to slug text.
  }

  redirect(`/photos?search=${encodeURIComponent(searchTitle)}`);
}
