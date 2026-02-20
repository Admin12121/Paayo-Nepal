"use client";

import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DashboardCardProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export default function DashboardCard({
  children,
  className,
  contentClassName,
}: DashboardCardProps) {
  return (
    <Card className={cn(className)}>
      <CardContent className={cn("p-6", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}
