"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: ModalProps) {
  const sizes = {
    sm: "sm:max-w-md",
    md: "sm:max-w-lg",
    lg: "sm:max-w-2xl",
    xl: "sm:max-w-4xl",
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className={cn(
          "w-[calc(100%-2rem)] max-h-[90vh] overflow-hidden rounded-lg p-0",
          sizes[size],
        )}
      >
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="text-xl font-semibold text-gray-900">
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <DialogFooter className="border-t bg-gray-50 px-6 py-4 sm:justify-end">
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
