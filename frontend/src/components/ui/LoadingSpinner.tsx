import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = "md",
  label,
  className,
}) => {
  const sizeStyles = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-10 h-10",
  }[size];

  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 text-zinc-400", className)}>
      <Loader2 className={cn("animate-spin text-orange-500", sizeStyles)} />
      {label && <p className="text-sm font-medium animate-pulse">{label}</p>}
    </div>
  );
};
