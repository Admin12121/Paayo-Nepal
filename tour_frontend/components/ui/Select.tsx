import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

type SelectOption = {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
};

const EMPTY_VALUE_SENTINEL = "__PAAYO_EMPTY_SELECT_VALUE__";

function toInternalValue(value: string): string {
  return value === "" ? EMPTY_VALUE_SENTINEL : value;
}

function toExternalValue(value: string): string {
  return value === EMPTY_VALUE_SENTINEL ? "" : value;
}

interface SelectProps extends Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  "onChange" | "children"
> {
  label?: string;
  error?: string;
  options?: SelectOption[];
  helperText?: string;
  containerClassName?: string;
  onChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  onValueChange?: (value: string) => void;
  children?: React.ReactNode;
  placeholder?: string;
}

function parseChildrenOptions(children: React.ReactNode): SelectOption[] {
  return React.Children.toArray(children).flatMap((child) => {
    if (!React.isValidElement(child) || child.type !== "option") {
      return [];
    }

    const optionChild = child as React.ReactElement<{
      value?: string;
      disabled?: boolean;
      children?: React.ReactNode;
    }>;

    return [
      {
        value: String(optionChild.props.value ?? ""),
        label: optionChild.props.children,
        disabled: Boolean(optionChild.props.disabled),
      },
    ];
  });
}

const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      className,
      label,
      error,
      options,
      helperText,
      containerClassName,
      children,
      value,
      defaultValue,
      onChange,
      onValueChange,
      name,
      required,
      disabled,
      id,
      placeholder,
    },
    ref,
  ) => {
    const selectId = React.useId();
    const fieldId = id || selectId;
    const items = React.useMemo(
      () => (options?.length ? options : parseChildrenOptions(children)),
      [options, children],
    );

    const currentValue =
      value !== undefined ? toInternalValue(String(value)) : undefined;
    const initialValue =
      defaultValue !== undefined
        ? toInternalValue(String(defaultValue))
        : undefined;

    const emitChange = React.useCallback(
      (internalValue: string) => {
        const nextValue = toExternalValue(internalValue);
        onValueChange?.(nextValue);

        if (!onChange) return;

        const syntheticEvent = {
          target: { value: nextValue, name: name || "" },
          currentTarget: { value: nextValue, name: name || "" },
        } as React.ChangeEvent<HTMLSelectElement>;

        onChange(syntheticEvent);
      },
      [onChange, onValueChange, name],
    );

    return (
      <div className={cn("", containerClassName)}>
        {label && (
          <label
            htmlFor={fieldId}
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            {label}
            {required && <span className="ml-1 text-red-500">*</span>}
          </label>
        )}

        <SelectPrimitive.Root
          value={currentValue}
          defaultValue={initialValue}
          onValueChange={emitChange}
          disabled={disabled}
          name={name}
          required={required}
        >
          <SelectPrimitive.Trigger
            ref={ref}
            id={fieldId}
            data-slot="select"
            className={cn(
              "flex h-9 w-full min-w-0 items-center justify-between rounded-md border bg-white px-3 py-1 text-sm shadow-sm transition-colors outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50",
              error ? "border-red-500" : "border-gray-300",
              disabled && "bg-gray-100",
              className,
            )}
            aria-invalid={Boolean(error)}
          >
            <SelectPrimitive.Value
              placeholder={placeholder || "Select an option"}
            />
            <SelectPrimitive.Icon asChild>
              <ChevronDown className="h-4 w-4 text-gray-500" />
            </SelectPrimitive.Icon>
          </SelectPrimitive.Trigger>

          <SelectPrimitive.Portal>
            <SelectPrimitive.Content
              position="popper"
              sideOffset={4}
              className="z-50 max-h-80 min-w-[8rem] overflow-hidden rounded-md border border-gray-200 bg-white shadow-md"
            >
              <SelectPrimitive.ScrollUpButton className="flex h-6 items-center justify-center bg-white text-gray-500">
                <ChevronUp className="h-4 w-4" />
              </SelectPrimitive.ScrollUpButton>

              <SelectPrimitive.Viewport className="p-1">
                {items.map((item, index) => (
                  <SelectPrimitive.Item
                    key={`${item.value}-${index}`}
                    value={toInternalValue(item.value)}
                    disabled={item.disabled}
                    className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm text-gray-700 outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-gray-100 data-[highlighted]:text-gray-900"
                  >
                    <SelectPrimitive.ItemIndicator className="absolute left-2 inline-flex items-center justify-center">
                      <Check className="h-4 w-4 text-blue-600" />
                    </SelectPrimitive.ItemIndicator>
                    <SelectPrimitive.ItemText>
                      {item.label}
                    </SelectPrimitive.ItemText>
                  </SelectPrimitive.Item>
                ))}
              </SelectPrimitive.Viewport>

              <SelectPrimitive.ScrollDownButton className="flex h-6 items-center justify-center bg-white text-gray-500">
                <ChevronUp className="h-4 w-4 rotate-180" />
              </SelectPrimitive.ScrollDownButton>
            </SelectPrimitive.Content>
          </SelectPrimitive.Portal>
        </SelectPrimitive.Root>

        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        {helperText && !error && (
          <p className="mt-1 text-sm text-gray-500">{helperText}</p>
        )}
      </div>
    );
  },
);

Select.displayName = "Select";

export default Select;
