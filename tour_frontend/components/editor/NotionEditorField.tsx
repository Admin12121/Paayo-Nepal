"use client";

import TiptapEditor from "@/components/editor/TiptapEditor";
import Label from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface NotionEditorFieldProps {
  initialContent?: string;
  onChange: (html: string) => void;
  placeholder?: string;
  uploadImage?: (file: File) => Promise<string>;
  label?: string;
  hint?: string;
  className?: string;
  variant?: "card" | "inline";
}

export default function NotionEditorField({
  initialContent,
  onChange,
  placeholder = "Type '/' for commands, or just start writing...",
  uploadImage,
  label,
  hint,
  className,
  variant = "card",
}: NotionEditorFieldProps) {
  const hasHeader = Boolean(label || hint);

  const editor = (
    <div className="notion-editor">
      <TiptapEditor
        initialContent={initialContent}
        onChange={onChange}
        placeholder={placeholder}
        uploadImage={uploadImage}
      />
    </div>
  );

  if (variant === "inline") {
    return (
      <section className={cn("space-y-3", className)}>
        {hasHeader && (
          <div className="flex items-center justify-between gap-3">
            {label ? (
              <Label className="mb-0 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                {label}
              </Label>
            ) : (
              <span />
            )}
            {hint && (
              <p className="hidden text-[11px] text-zinc-400 sm:block">
                {hint}
              </p>
            )}
          </div>
        )}
        {editor}
      </section>
    );
  }

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm",
        className,
      )}
    >
      {hasHeader && (
        <>
          <div className="flex items-center justify-between gap-3 bg-zinc-50/80 px-5 py-3">
            {label ? (
              <Label className="mb-0 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                {label}
              </Label>
            ) : (
              <span />
            )}
            {hint && (
              <p className="hidden text-[11px] text-zinc-400 sm:block">
                {hint}
              </p>
            )}
          </div>
          <Separator />
        </>
      )}
      <div className="px-5 py-4">{editor}</div>
    </section>
  );
}
