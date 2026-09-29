"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

export interface FlagOption<V extends string> {
  value: V;
  label: string;
  /** Image path in public/flags/. */
  flag: string;
  lang?: string;
}

/** A small flag image; decorative, since the language name is the label. */
function Flag({ src }: { src: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a tiny static SVG
    <img
      src={src}
      alt=""
      width={21}
      height={14}
      className="h-3.5 w-auto shrink-0 rounded-[2px] shadow-[0_0_0_1px_var(--border)]"
    />
  );
}

/**
 * A language menu with flag images (a native <select> can't show them):
 * a button that opens a listbox. Used for Site language and I'm learning.
 */
export function FlagSelect<V extends string>({
  id,
  labelId,
  value,
  options,
  placeholder,
  disabled,
  onChange,
}: {
  id: string;
  /** The visible label's id, which names the button. */
  labelId: string;
  value: V | undefined;
  options: readonly FlagOption<V>[];
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: V) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (open)
      listRef.current
        ?.querySelectorAll<HTMLElement>("[role=option]")
        [active]?.focus();
  }, [open, active]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  function openList() {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  }

  function choose(option: FlagOption<V>) {
    setOpen(false);
    buttonRef.current?.focus();
    if (option.value !== value) onChange(option.value);
  }

  function onListKeyDown(e: KeyboardEvent) {
    const last = options.length - 1;
    const moves: Record<string, number> = {
      ArrowDown: Math.min(active + 1, last),
      ArrowUp: Math.max(active - 1, 0),
      Home: 0,
      End: last,
    };
    if (e.key in moves) {
      e.preventDefault();
      setActive(moves[e.key]);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(options[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (e.key === "Tab") {
      // Tab on from the button, to whatever comes after the menu.
      buttonRef.current?.focus();
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${labelId} ${id}`}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            openList();
          }
        }}
        className="flex h-11 items-center gap-2 rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        {current ? (
          <>
            <Flag src={current.flag} />
            <span lang={current.lang}>{current.label}</span>
          </>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <ChevronDown aria-hidden className="size-4 text-muted-foreground" />
      </button>
      {open && (
        <ul
          ref={listRef}
          role="listbox"
          aria-labelledby={labelId}
          onKeyDown={onListKeyDown}
          className="absolute right-0 z-50 mt-1 min-w-full rounded-md border bg-popover py-1 text-popover-foreground shadow-md"
        >
          {options.map((o, i) => {
            const selected = o.value === value;
            return (
              <li
                key={o.value}
                role="option"
                aria-selected={selected}
                tabIndex={-1}
                lang={o.lang}
                onClick={() => choose(o)}
                onPointerMove={() => setActive(i)}
                className={`flex min-h-11 cursor-pointer items-center gap-2 whitespace-nowrap px-3 text-sm outline-none focus:bg-accent focus:text-accent-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                  selected ? "font-semibold" : ""
                }`}
              >
                <Flag src={o.flag} />
                <span className="flex-1">{o.label}</span>
                <Check
                  aria-hidden
                  className={`size-4 ${selected ? "" : "invisible"}`}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
