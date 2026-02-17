"use client";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MoreHorizontalIcon,
} from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function PageLink({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  onClick: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <a
      href="#"
      aria-current={active ? "page" : undefined}
      className={cn(
        buttonVariants({
          variant: active ? "outline" : "ghost",
          size: "icon",
        }),
      )}
      onClick={onClick}
    >
      {children}
    </a>
  );
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages: number[] = [];
  const maxVisible = 5;

  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  const endPage = Math.min(totalPages, startPage + maxVisible - 1);

  if (endPage - startPage + 1 < maxVisible) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  const goTo = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) return;
    onPageChange(page);
  };

  return (
    <nav
      role="navigation"
      aria-label="pagination"
      className="mx-auto flex w-full justify-center"
    >
      <ul className="flex flex-row items-center gap-1">
        <li>
          <a
            href="#"
            aria-label="Go to previous page"
            className={cn(
              buttonVariants({ variant: "ghost", size: "default" }),
              "gap-1 px-2.5",
              currentPage === 1 && "pointer-events-none opacity-50",
            )}
            onClick={(e) => {
              e.preventDefault();
              goTo(currentPage - 1);
            }}
          >
            <ChevronLeftIcon className="size-4" />
            <span className="hidden sm:block">Previous</span>
          </a>
        </li>

        {startPage > 1 ? (
          <>
            <li>
              <PageLink
                onClick={(e) => {
                  e.preventDefault();
                  goTo(1);
                }}
              >
                1
              </PageLink>
            </li>
            {startPage > 2 ? (
              <li>
                <span
                  className="flex size-9 items-center justify-center"
                  aria-hidden
                >
                  <MoreHorizontalIcon className="size-4" />
                </span>
              </li>
            ) : null}
          </>
        ) : null}

        {pages.map((page) => (
          <li key={page}>
            <PageLink
              active={page === currentPage}
              onClick={(e) => {
                e.preventDefault();
                goTo(page);
              }}
            >
              {page}
            </PageLink>
          </li>
        ))}

        {endPage < totalPages ? (
          <>
            {endPage < totalPages - 1 ? (
              <li>
                <span
                  className="flex size-9 items-center justify-center"
                  aria-hidden
                >
                  <MoreHorizontalIcon className="size-4" />
                </span>
              </li>
            ) : null}
            <li>
              <PageLink
                onClick={(e) => {
                  e.preventDefault();
                  goTo(totalPages);
                }}
              >
                {totalPages}
              </PageLink>
            </li>
          </>
        ) : null}

        <li>
          <a
            href="#"
            aria-label="Go to next page"
            className={cn(
              buttonVariants({ variant: "ghost", size: "default" }),
              "gap-1 px-2.5",
              currentPage === totalPages && "pointer-events-none opacity-50",
            )}
            onClick={(e) => {
              e.preventDefault();
              goTo(currentPage + 1);
            }}
          >
            <span className="hidden sm:block">Next</span>
            <ChevronRightIcon className="size-4" />
          </a>
        </li>
      </ul>
    </nav>
  );
}
