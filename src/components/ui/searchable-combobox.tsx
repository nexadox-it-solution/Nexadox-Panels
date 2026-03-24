"use client";

import * as React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import { Check, ChevronDown, Search, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchableComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  /** Static options (always shown, merged with DB results) */
  staticOptions?: readonly string[] | string[];
  /** Lookup table key for /api/rx-lookup (e.g. "medicine_names") */
  lookupTable?: string;
  placeholder?: string;
  className?: string;
}

/**
 * Searchable combobox with DB-backed suggestions.
 * If user types a value not in the list, they can select "Add: <value>" to use it.
 * New values are auto-saved to the lookup table on prescription save (handled by parent).
 */
export function SearchableCombobox({
  value, onValueChange, staticOptions = [], lookupTable, placeholder = "Select…", className,
}: SearchableComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dbOptions, setDbOptions] = useState<string[]>([]);
  const [fetching, setFetching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  /* Fetch from DB on search change */
  const fetchOptions = useCallback(async (q: string) => {
    if (!lookupTable) return;
    setFetching(true);
    try {
      const res = await fetch(`/api/rx-lookup?table=${lookupTable}&q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setDbOptions(data.items || []);
      }
    } catch { /* ignore */ }
    finally { setFetching(false); }
  }, [lookupTable]);

  /* Debounced search */
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchOptions(search), 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, open, fetchOptions]);

  /* Load initial options when opened */
  useEffect(() => {
    if (open && lookupTable) fetchOptions("");
  }, [open, lookupTable, fetchOptions]);

  /* Close on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* Focus input when opened */
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  /* Merge static + DB options, deduplicate */
  const allOptions = React.useMemo(() => {
    const set = new Set<string>();
    [...staticOptions].forEach(o => set.add(o));
    dbOptions.forEach(o => set.add(o));
    const arr = Array.from(set);
    if (!search) return arr;
    return arr.filter(o => o.toLowerCase().includes(search.toLowerCase()));
  }, [staticOptions, dbOptions, search]);

  /* Check if typed value is new */
  const trimmedSearch = search.trim();
  const isNewValue = trimmedSearch && !allOptions.some(o => o.toLowerCase() === trimmedSearch.toLowerCase());

  const selectValue = (val: string) => {
    onValueChange(val);
    setOpen(false);
    setSearch("");
  };

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        <span className={cn("truncate", value ? "text-foreground" : "text-muted-foreground")}>
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
              onKeyDown={e => {
                if (e.key === "Enter" && trimmedSearch) {
                  e.preventDefault();
                  selectValue(trimmedSearch);
                }
              }}
              placeholder="Type to search…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {fetching && <div className="h-3 w-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin ml-1" />}
          </div>

          {/* Options */}
          <div className="max-h-48 overflow-y-auto p-1">
            {/* "Add new" option */}
            {isNewValue && (
              <button
                type="button"
                onClick={() => selectValue(trimmedSearch)}
                className="relative flex w-full items-center rounded-sm py-1.5 pl-3 pr-2 text-sm cursor-pointer hover:bg-blue-50 text-blue-700 font-medium gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> Add &quot;{trimmedSearch}&quot;
              </button>
            )}

            {allOptions.length === 0 && !isNewValue ? (
              <p className="text-xs text-muted-foreground text-center py-3">
                {fetching ? "Loading…" : "No results — type to add new"}
              </p>
            ) : (
              allOptions.map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => selectValue(opt)}
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
