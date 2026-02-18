import Image from "next/image";
import Link from "next/link";
import { postsApi } from "@/lib/api-client";

const QUICK_LINKS = [
  { label: "Stays", href: "/search?q=stays" },
  { label: "Flights", href: "/search?q=flights" },
  { label: "Tours", href: "/search?q=tours" },
  { label: "Rental", href: "/search?q=rental" },
  { label: "Adventure", href: "/search?q=adventure" },
  { label: "Shopping", href: "/search?q=shopping" },
  { label: "Organic Products", href: "/search?q=organic-products" },
] as const;

export async function InfoUpdatesSection() {
  let items: Awaited<ReturnType<typeof postsApi.list>>["data"] = [];

  try {
    const response = await postsApi.list({
      limit: 4,
      status: "published",
      type: "article",
      sort_by: "latest",
    });
    items = response.data;
  } catch {
    items = [];
  }

  if (items.length === 0) return null;

  return (
    <section className="bg-white px-6 py-10">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-8 flex flex-wrap items-center gap-3">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="rounded-full border border-[#D5D8E1] px-4 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-[#4A5876] transition-colors hover:border-[#0078C0] hover:text-[#0078C0]"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/blogs/${item.slug}`}
              className="overflow-hidden rounded-xl border border-[#E7ECF4] bg-white shadow-[0_8px_20px_rgba(19,39,66,0.08)] transition-shadow hover:shadow-[0_10px_26px_rgba(19,39,66,0.14)]"
            >
              <div className="relative h-[170px] w-full bg-[#EEF2F8]">
                {item.cover_image ? (
                  <Image
                    src={item.cover_image}
                    alt={item.title}
                    fill
                    className="object-cover"
                  />
                ) : null}
              </div>
              <div className="p-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0078C0]">
                  {new Date(item.published_at || item.created_at)
                    .toLocaleDateString("en-US", {
                      month: "short",
                      day: "2-digit",
                      year: "numeric",
                    })
                    .toUpperCase()}
                </p>
                <h3 className="line-clamp-2 text-base font-semibold text-[#173056]">
                  {item.title}
                </h3>
                <p className="mt-2 line-clamp-2 text-sm text-[#6A7898]">
                  {item.short_description ||
                    "Read the latest update from Paayo Nepal."}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
