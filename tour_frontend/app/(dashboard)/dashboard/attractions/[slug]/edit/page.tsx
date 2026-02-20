import { redirect } from "next/navigation";

export default async function LegacyAttractionEditRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/dashboard/attractions/${slug}`);
}
