"use client";

import * as React from "react";
import { useState, useRef, useEffect } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchableSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly string[] | string[];
  placeholder?: string;
  className?: string;
}

export function SearchableSelect({ value, onValueChange, options, placeholder = "Select…", className }: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = search
    ? options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
    : [...options];

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        <span className={value ? "text-foreground" : "text-muted-foreground"}>
          {value || placeholder}
        </span>
        <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-full min-w-[10rem] rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95">
          {/* Search input */}
          <div className="flex items-center border-b px-2 py-1.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground mr-1.5 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          {/* Options */}
          <div className="max-h-48 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">No results</p>
            ) : (
              filtered.map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => { onValueChange(opt); setOpen(false); setSearch(""); }}
                  className={cn(
                    "relative flex w-full items-center rounded-sm py-1.5 pl-8 pr-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground",
                    value === opt && "bg-accent/50 font-medium"
                  )}
                >
                  {value === opt && (
                    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                      <Check className="h-4 w-4 text-primary" />
                    </span>
                  )}
                  {opt}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
