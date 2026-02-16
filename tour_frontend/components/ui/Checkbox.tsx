import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> {
  label?: string;
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, ...props }, ref) => {
    return (
      <label
        className={cn(
          "inline-flex items-center",
          props.disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        )}
      >
        <input
          ref={ref}
          type="checkbox"
          data-slot="checkbox"
          className={cn(
            "h-4 w-4 rounded border border-gray-300 bg-white text-blue-600 shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-blue-100 focus-visible:outline-none",
            className,
          )}
          {...props}
        />
        {label && <span className="ml-2 text-sm text-gray-700">{label}</span>}
      </label>
    );
  },
);

Checkbox.displayName = "Checkbox";

export default Checkbox;
