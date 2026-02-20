import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export default function LoadingSpinner({
  size = "md",
}: {
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "size-4",
    md: "size-8",
    lg: "size-12",
  };

  return (
    <div className="flex items-center justify-center p-8">
      <Spinner className={cn("text-blue-600", sizes[size])} />
    </div>
  );
}
