import { requireActive } from "@/lib/require-active";

export default async function PostsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireActive();
  return <>{children}</>;
}
