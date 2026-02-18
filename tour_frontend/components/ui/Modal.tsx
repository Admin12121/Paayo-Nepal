"use client";

import { useCallback, type ReactNode } from "react";
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
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) return;
      if (isOpen) onClose();
    },
    [isOpen, onClose],
  );

  const sizes = {
    sm: "sm:max-w-md",
    md: "sm:max-w-lg",
    lg: "sm:max-w-2xl",
    xl: "sm:max-w-4xl",
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          "flex w-[calc(100%-2rem)] max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-lg p-0",
          sizes[size],
        )}
      >
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle className="text-xl font-semibold text-gray-900">
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-6 pb-4">
          {children}
        </div>
        {footer && (
          <DialogFooter className="shrink-0 border-t bg-gray-50 px-6 py-4 sm:justify-end">
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
