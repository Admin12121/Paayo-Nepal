"use client";

import { motion } from "framer-motion";

const DURATION = 0.25;
const STAGGER = 0.025;

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

  return (
    <Tag
      initial="initial"
      whileHover="hovered"
      {...(as === "a" && href ? { href } : {})}
      className={`relative inline-block overflow-hidden whitespace-nowrap align-middle cursor-pointer ${className}`}
    >
      <div aria-hidden="false">
        {children.split("").map((l, i) => (
          <motion.span
            variants={{
              initial: { y: 0 },
              hovered: { y: "-100%" },
            }}
            transition={{
              duration: DURATION,
              ease: "easeInOut",
              delay: STAGGER * i,
            }}
            className="inline-block"
            key={i}
          >
            {l === " " ? "\u00A0" : l}
          </motion.span>
        ))}
      </div>
      <div className="absolute inset-0" aria-hidden="true">
        {children.split("").map((l, i) => (
          <motion.span
            variants={{
              initial: { y: "100%" },
              hovered: { y: 0 },
            }}
            transition={{
              duration: DURATION,
              ease: "easeInOut",
              delay: STAGGER * i,
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
