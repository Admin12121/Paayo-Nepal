"use client";

import { motion } from "framer-motion";

const DURATION = 0.22;
const BASE_STAGGER = 0.02;
const MAX_TOTAL_STAGGER = 0.18;

interface FlipTextProps {
  children: string;
  className?: string;
  as?: "a" | "span" | "div" | "p";
  href?: string;
}

export default function FlipText({
  children,
  className = "",
  as = "span",
  href,
}: FlipTextProps) {
  const Tag = as === "a" ? motion.a : motion[as];
  const letters = Array.from(children);
  const stagger =
    letters.length > 0
      ? Math.min(BASE_STAGGER, MAX_TOTAL_STAGGER / letters.length)
      : BASE_STAGGER;

  return (
    <Tag
      initial="initial"
      whileHover="hovered"
      {...(as === "a" && href ? { href } : {})}
      className={`relative inline-block overflow-hidden whitespace-nowrap align-middle cursor-pointer ${className}`}
    >
      <div aria-hidden="false">
        {letters.map((l, i) => (
          <motion.span
            variants={{
              initial: { y: 0 },
              hovered: { y: "-100%" },
            }}
            transition={{
              duration: DURATION,
              ease: "easeInOut",
              delay: stagger * i,
            }}
            className="inline-block"
            key={i}
          >
            {l === " " ? "\u00A0" : l}
          </motion.span>
        ))}
      </div>
      <div className="absolute inset-0" aria-hidden="true">
        {letters.map((l, i) => (
          <motion.span
            variants={{
              initial: { y: "100%" },
              hovered: { y: 0 },
            }}
            transition={{
              duration: DURATION,
              ease: "easeInOut",
              delay: stagger * i,
            }}
            className="inline-block"
            key={i}
          >
            {l === " " ? "\u00A0" : l}
          </motion.span>
        ))}
      </div>
    </Tag>
  );
}
