import React from "react";
import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "glass" | "bordered";
}

export const Card: React.FC<CardProps> = ({
  className,
  variant = "glass",
  children,
  ...props
}) => {
  const variantStyles = {
    default: "bg-zinc-900 border border-zinc-800",
    glass: "bg-zinc-900/70 backdrop-blur-md border border-zinc-800/80 shadow-xl",
    bordered: "bg-zinc-950 border border-zinc-700/60",
  }[variant];

  return (
    <div
      className={cn("rounded-xl transition-all duration-200", variantStyles, className)}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div className={cn("px-6 py-4 border-b border-zinc-800/60", className)} {...props}>
      {children}
    </div>
  );
};

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <h3
      className={cn("text-base font-semibold text-zinc-100 flex items-center gap-2", className)}
      {...props}
    >
      {children}
    </h3>
  );
};

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <p className={cn("text-xs text-zinc-400 mt-1", className)} {...props}>
      {children}
    </p>
  );
};

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div className={cn("p-6", className)} {...props}>
      {children}
    </div>
  );
};
