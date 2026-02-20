import { requireActive } from "@/lib/require-active";

export default async function AttractionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireActive();
  return <>{children}</>;
}
