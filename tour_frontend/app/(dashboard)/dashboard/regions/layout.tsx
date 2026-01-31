import { requireActive } from "@/lib/require-active";

export default async function RegionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireActive();
  return <>{children}</>;
}
