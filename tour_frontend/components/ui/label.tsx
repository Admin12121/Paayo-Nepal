"use client";

import * as React from "react";
import { Label as LabelPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Label };

interface LegacyLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

function LegacyLabel({
  className,
  required,
  children,
  ...props
}: LegacyLabelProps) {
  return (
    <label
      data-slot="legacy-label"
      className={cn("mb-1 block text-sm font-medium text-gray-700", className)}
      {...props}
    >
      {children}
      {required && <span className="ml-1 text-red-500">*</span>}
    </label>
  );
}

export default LegacyLabel;
