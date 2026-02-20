import { requireActive } from "@/lib/require-active";

export default async function MediaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireActive();
  return <>{children}</>;
}
