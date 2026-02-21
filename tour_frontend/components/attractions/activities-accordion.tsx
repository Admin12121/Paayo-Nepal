"use client";

import Link from "@/components/ui/animated-link";
import { Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";

export type ActivityAccordionItem = {
  id: string;
  title: string;
  href: string;
  image: string | null;
  subtitle: string | null;
};

type ActivitiesAccordionProps = {
  items: ActivityAccordionItem[];
};

export function ActivitiesAccordion({ items }: ActivitiesAccordionProps) {
  const [singleExpandedId, setSingleExpandedId] = useState<string | null>(
    items[0]?.id ?? null,
  );
  const [allExpanded, setAllExpanded] = useState(false);

  useEffect(() => {
    if (items.length === 0) {
      setSingleExpandedId(null);
      setAllExpanded(false);
      return;
    }

    setSingleExpandedId((current) =>
      current && items.some((item) => item.id === current)
        ? current
        : items[0].id,
    );
  }, [items]);

  const toggleAll = () => {
    if (items.length === 0) return;

    if (allExpanded) {
      setAllExpanded(false);
      setSingleExpandedId((current) =>
        current && items.some((item) => item.id === current)
          ? current
          : items[0].id,
      );
      return;
    }

    setAllExpanded(true);
  };

  const toggleItem = (id: string) => {
    setAllExpanded(false);
    setSingleExpandedId(id);
  };

  return (
    <section id="activities" className="min-w-0 overflow-x-hidden pt-10">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-3xl font-semibold uppercase tracking-wide text-[#1A2B49]">
          ACTIVITIES
        </h2>
        {items.length > 1 ? (
          <button
            type="button"
            onClick={toggleAll}
            className="text-sm font-medium text-[#1A2B49] underline underline-offset-4 hover:text-[#0078C0]"
          >
            {allExpanded ? "Collapse All" : "Expand All"}
          </button>
        ) : null}
      </div>

      <p className="mt-2 text-[#4B5563]">
        Explore activities and plans connected to this attraction.
      </p>

      {items.length === 0 ? (
        <p className="mt-5 text-sm text-[#6B7280]">
          No activity recommendations available.
        </p>
      ) : (
        <ol className="mt-5 space-y-5">
          {items.map((item, index) => {
            const isExpanded = allExpanded || singleExpandedId === item.id;

            return (
              <li key={item.id} className="border-b border-[#E5E7EB] pb-5">
                <button
                  type="button"
                  onClick={() => toggleItem(item.id)}
                  className="flex w-full items-start justify-between gap-3 text-left"
                  aria-expanded={isExpanded}
                >
                  <span className="min-w-0 flex-1 break-words text-2xl font-display leading-tight text-[#1A2B49] md:text-4xl">
                    {index + 1}. {item.title}
                  </span>
                  {isExpanded ? (
                    <Minus className="mt-1 h-5 w-5 shrink-0 text-[#1A2B49]" />
                  ) : (
                    <Plus className="mt-1 h-5 w-5 shrink-0 text-[#1A2B49]" />
                  )}
                </button>

                <div
                  className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                    isExpanded
                      ? "mt-4 grid-rows-[1fr] opacity-100"
                      : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="min-h-0 overflow-hidden">
                    <div className="space-y-4 pb-1">
                      {item.image ? (
                        <Link
                          href={item.href}
                          className="block overflow-hidden rounded-md"
                        >
                          <img
                            src={item.image}
                            alt={item.title}
                            className="h-[240px] w-full object-cover md:h-[360px]"
                          />
                        </Link>
                      ) : null}

                      <p className="text-lg leading-relaxed text-[#5B667A]">
                        {item.subtitle ||
                          "Discover this destination and plan your visit with local insights and practical tips."}
                      </p>

                      <Link
                        href={item.href}
                        className="inline-flex text-sm font-semibold uppercase tracking-[0.08em] text-[#0078C0] hover:text-[#00629C]"
                      >
                        Read More
                      </Link>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
