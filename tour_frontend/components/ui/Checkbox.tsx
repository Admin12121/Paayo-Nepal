import { InputHTMLAttributes, forwardRef } from "react";
import { clsx } from "clsx";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, ...props }, ref) => {
    return (
      <label className="flex items-center cursor-pointer">
        <input
          ref={ref}
          type="checkbox"
          className={clsx(
            "w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer",
            props.disabled && "opacity-50 cursor-not-allowed",
            className
          )}
          {...props}
        />
        {label && (
          <span className="ml-2 text-sm text-gray-700">{label}</span>
        )}
      </label>
    );
  }
);

Checkbox.displayName = "Checkbox";

export default Checkbox;
