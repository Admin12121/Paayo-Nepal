"use client";

import Link from "@/components/ui/animated-link";
import { Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";

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
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(items[0] ? [items[0].id] : []),
  );

  const allExpanded = useMemo(
    () => items.length > 0 && items.every((item) => expandedIds.has(item.id)),
    [items, expandedIds],
  );

  const toggleAll = () => {
    if (allExpanded) {
      setExpandedIds(new Set());
      return;
    }
    setExpandedIds(new Set(items.map((item) => item.id)));
  };

  const toggleItem = (id: string) => {
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <section id="activities" className="pt-10">
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
            const isExpanded = expandedIds.has(item.id);

            return (
              <li key={item.id} className="border-b border-[#E5E7EB] pb-5">
                <button
                  type="button"
                  onClick={() => toggleItem(item.id)}
                  className="flex w-full items-center justify-between gap-4 text-left"
                >
                  <span className="text-[38px] font-display leading-tight text-[#1A2B49] md:text-[44px]">
                    {index + 1}. {item.title}
                  </span>
                  {isExpanded ? (
                    <Minus className="h-5 w-5 shrink-0 text-[#1A2B49]" />
                  ) : (
                    <Plus className="h-5 w-5 shrink-0 text-[#1A2B49]" />
                  )}
                </button>

                {isExpanded ? (
                  <div className="mt-4 space-y-4">
                    {item.image ? (
                      <Link
                        href={item.href}
                        className="block overflow-hidden rounded-md"
                      >
                        <img
                          src={item.image}
                          alt={item.title}
                          className="h-[360px] w-full object-cover"
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
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
