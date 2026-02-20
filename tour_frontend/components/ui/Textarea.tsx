import * as React from "react";
import { cn } from "@/lib/utils";

interface TextareaProps extends React.ComponentProps<"textarea"> {
  label?: string;
  error?: string;
  helperText?: string;
  containerClassName?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    { className, label, error, helperText, containerClassName, ...props },
    ref,
  ) => {
    const textareaNode = (
      <textarea
        ref={ref}
        data-slot="textarea"
        className={cn(
          "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "border-gray-300 focus-visible:border-blue-500 focus-visible:ring-blue-100",
          error && "border-red-500 focus-visible:border-red-500",
          className,
        )}
        {...props}
      />
    );

    if (!label && !error && !helperText) {
      return textareaNode;
    }

    return (
      <div className={cn("w-full", containerClassName)}>
        {label ? (
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {label}
            {props.required ? <span className="ml-1 text-red-500">*</span> : null}
          </label>
        ) : null}
        {textareaNode}
        {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
        {helperText && !error ? (
          <p className="mt-1 text-sm text-gray-500">{helperText}</p>
        ) : null}
      </div>
    );
  },
);

Textarea.displayName = "Textarea";

export default Textarea;
export { Textarea };
