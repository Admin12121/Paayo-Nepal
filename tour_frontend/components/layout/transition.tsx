"use client";
import { useRef, useEffect, type ReactNode } from "react";
import { TransitionRouter } from "next-transition-router";
import gsap from "gsap";

const BLOCK_SIZE = 60; // Size of each block in pixels

type TransitionProvidersProps = {
  children: ReactNode;
};

export default function TransitionProviders({
  children,
}: TransitionProvidersProps) {
  const transitionGridRef = useRef<HTMLDivElement | null>(null);
  const blocksRef = useRef<HTMLDivElement[]>([]);

  const createTransitionBlocks = () => {
    if (!transitionGridRef.current) return;

    const container = transitionGridRef.current;
    container.innerHTML = "";
    blocksRef.current = [];

    const gridWidth = window.innerWidth;
    const gridHeight = window.innerHeight;

    const cols = Math.ceil(gridWidth / BLOCK_SIZE);
    const rows = Math.ceil(gridHeight / BLOCK_SIZE) * 1;
    const offsetX = (gridWidth - cols * BLOCK_SIZE) / 2;
    const offsetY = (gridHeight - rows * BLOCK_SIZE) / 2;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const block = document.createElement("div");
        block.className = "transition-block";
        block.style.cssText = `
          width: ${BLOCK_SIZE}px;
          height: ${BLOCK_SIZE}px;
          top: ${row * BLOCK_SIZE + offsetY}px;
          left: ${col * BLOCK_SIZE + offsetX}px;
          `;
        container.appendChild(block);
        blocksRef.current.push(block);
      }
    }
    gsap.set(blocksRef.current, { opacity: 0 });
  };

  useEffect(() => {
    createTransitionBlocks();
    window.addEventListener("resize", createTransitionBlocks);
    return () => {
      window.removeEventListener("resize", createTransitionBlocks);
    };
  }, []);

  return (
    <TransitionRouter
      auto
      leave={(next) => {
        const tween = gsap.to(blocksRef.current, {
          opacity: 1,
          duration: 0.05,
          ease: "power2.inOut",
          stagger: { amount: 0.5, from: "random" },
          onComplete: next,
        });
        return () => tween.kill();
      }}
      enter={(next) => {
        gsap.set(blocksRef.current, { opacity: 1 });
        const tween = gsap.to(blocksRef.current, {
          opacity: 0,
          duration: 0.05,
          delay: 0.3,
          ease: "power2.inOut",
          stagger: { amount: 0.5, from: "random" },
          onComplete: next,
        });
        return () => tween.kill();
      }}
    >
      <div ref={transitionGridRef} className="transition-grid" />
      {children}
    </TransitionRouter>
  );
}
