"use client";

import * as React from "react";

/* ─── Tabs Root ───────────────────────────────────────────── */
interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

const TabsContext = React.createContext<{
  value: string;
  onValueChange: (v: string) => void;
}>({ value: "", onValueChange: () => {} });

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ defaultValue = "", value, onValueChange, className = "", children, ...props }, ref) => {
    const [internalValue, setInternalValue] = React.useState(defaultValue);
    const current = value ?? internalValue;
    const change = React.useCallback(
      (v: string) => {
        if (value === undefined) setInternalValue(v);
        onValueChange?.(v);
      },
      [value, onValueChange],
    );
    return (
      <TabsContext.Provider value={{ value: current, onValueChange: change }}>
        <div ref={ref} className={className} {...props}>
          {children}
        </div>
      </TabsContext.Provider>
    );
  },
);
Tabs.displayName = "Tabs";

/* ─── TabsList ────────────────────────────────────────────── */
const TabsList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = "", ...props }, ref) => (
    <div
      ref={ref}
      className={`inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground ${className}`}
      {...props}
    />
  ),
);
TabsList.displayName = "TabsList";

/* ─── TabsTrigger ─────────────────────────────────────────── */
interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ value: triggerValue, className = "", ...props }, ref) => {
    const { value, onValueChange } = React.useContext(TabsContext);
    const isActive = value === triggerValue;
    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        aria-selected={isActive}
        onClick={() => onValueChange(triggerValue)}
        className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
          isActive ? "bg-background text-foreground shadow-sm" : ""
        } ${className}`}
        {...props}
      />
    );
  },
);
TabsTrigger.displayName = "TabsTrigger";

/* ─── TabsContent ─────────────────────────────────────────── */
interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ value: contentValue, className = "", ...props }, ref) => {
    const { value } = React.useContext(TabsContext);
    if (value !== contentValue) return null;
    return (
      <div
        ref={ref}
        role="tabpanel"
        className={`mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${className}`}
        {...props}
      />
    );
  },
);
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent };
