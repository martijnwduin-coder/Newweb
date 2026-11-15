"use client";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;
export const TabsContent = (props: React.ComponentProps<typeof TabsPrimitive.Content>) => (
  <TabsPrimitive.Content {...props} className={cn("mt-6 focus:outline-none animate-fade-up", props.className)} />
);

export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn("no-scrollbar flex gap-1 overflow-x-auto border-b border-cream-300", className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "relative -mb-px whitespace-nowrap border-b-2 border-transparent px-3 pb-3 pt-1 text-sm font-medium text-muted transition hover:text-charcoal data-[state=active]:border-forest data-[state=active]:text-forest",
        className,
      )}
      {...props}
    />
  );
}
