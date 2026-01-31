import { requireActive } from "@/lib/require-active";

export default async function ActivitiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireActive();
  return <>{children}</>;
}
