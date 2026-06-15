import { useEffect, useRef, useState } from "react";
import type { ControllerRenderProps } from "react-hook-form";

import { api } from "@/api/client";
import type { ConceptSuggestion } from "@/api/client";
import { Input } from "@/components/ui/input";

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  field: ControllerRenderProps<any, "concept">;
  onSuggestionSelect: (s: ConceptSuggestion) => void;
  placeholder?: string;
}

const MIN_CHARS = 2;
const DEBOUNCE_MS = 300;

export function ConceptAutocomplete({ field, onSuggestionSelect, placeholder }: Props) {
  const [suggestions, setSuggestions] = useState<ConceptSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = field.value as string;
    if (q.length < MIN_CHARS) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await api.transactions.suggestConcepts(q);
        setSuggestions(results);
        setOpen(results.length > 0);
        setActiveIndex(-1);
      } catch {
        setSuggestions([]);
        setOpen(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [field.value]);

  function select(s: ConceptSuggestion) {
    field.onChange(s.concept);
    onSuggestionSelect(s);
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      const s = suggestions[activeIndex];
      if (s) select(s);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  function handleBlur() {
    // Delay so the click on a suggestion registers before the list closes
    setTimeout(() => setOpen(false), 150);
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        {...field}
        placeholder={placeholder}
        autoComplete="off"
        onKeyDown={handleKeyDown}
        onBlur={() => {
          field.onBlur();
          handleBlur();
        }}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-md border bg-popover shadow-md">
          {suggestions.map((s, i) => (
            <li
              key={s.concept}
              className={`cursor-pointer px-3 py-2 text-sm ${
                i === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground"
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                select(s);
              }}
            >
              {s.concept}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
