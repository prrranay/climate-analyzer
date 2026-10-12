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
    default: "bg-[#0F172A] border border-[#334155]",
    glass: "bg-[#0F172A] backdrop-blur-md border border-[#334155] shadow-sm",
    bordered: "bg-[#090D16] border border-[#334155]",
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
    <div className={cn("px-5 py-3.5 border-b border-[#334155]", className)} {...props}>
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
      className={cn("text-sm font-semibold text-[#F8FAFC] flex items-center gap-2", className)}
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
    <p className={cn("text-xs text-[#94A3B8] mt-0.5", className)} {...props}>
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
    <div className={cn("p-5", className)} {...props}>
      {children}
    </div>
  );
};
