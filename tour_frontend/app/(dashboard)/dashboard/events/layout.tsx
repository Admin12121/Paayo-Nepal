import { requireActive } from "@/lib/require-active";

export default async function EventsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireActive();
  return <>{children}</>;
}
