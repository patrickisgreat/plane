/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { debounce } from "lodash-es";
import type { SuggestionProps } from "@tiptap/suggestion";
import { useOutsideClickDetector } from "@plane/hooks";
import { cn } from "@plane/utils";
// helpers
import { DROPDOWN_NAVIGATION_KEYS } from "@/helpers/tippy";
// types
import type { TWikiLinkHandler, TWikiLinkSuggestion } from "./types";

export type WikiLinkPopupProps = SuggestionProps<TWikiLinkSuggestion, TWikiLinkSuggestion> &
  Pick<TWikiLinkHandler, "searchPages"> & {
    onClose: () => void;
  };

export const WikiLinkPopup = forwardRef(function WikiLinkPopup(props: WikiLinkPopupProps, ref) {
  const { command, query, searchPages, onClose } = props;
  const [items, setItems] = useState<TWikiLinkSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectItem = useCallback(
    (index: number) => {
      const item = items[index];
      if (!item) return;
      command(item);
    },
    [items, command]
  );

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (!DROPDOWN_NAVIGATION_KEYS.includes(event.key)) return false;
      if (event.key === "Enter") {
        selectItem(selectedIndex);
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((i) => (items.length > 0 ? (i + 1) % items.length : 0));
        return true;
      }
      if (event.key === "ArrowUp") {
        setSelectedIndex((i) => (items.length > 0 ? (i - 1 + items.length) % items.length : 0));
        return true;
      }
      return true;
    },
  }));

  // Reset selection on each new result set so the highlight starts at the top.
  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  // oxlint-disable-next-line react-hooks/exhaustive-deps -- debounce wraps the function; deps are searchPages (captured by closure)
  const debouncedSearch = useCallback(
    debounce(async (searchQuery: string) => {
      try {
        const response = await searchPages(searchQuery);
        setItems(response ?? []);
      } catch (error) {
        console.error("WikiLink search failed:", error);
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    }, 200),
    [searchPages]
  );

  useEffect(() => {
    if (query !== undefined && query !== null) {
      setIsLoading(true);
      void debouncedSearch(query);
    }
  }, [query, debouncedSearch]);

  useEffect(
    () => () => {
      debouncedSearch.cancel();
    },
    [debouncedSearch]
  );

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const item = container.querySelector(`#wiki-link-item-${selectedIndex}`) as HTMLElement | null;
    if (item) {
      const containerRect = container.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      const isItemInView = itemRect.top >= containerRect.top && itemRect.bottom <= containerRect.bottom;
      if (!isItemInView) item.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  useOutsideClickDetector(containerRef, onClose);

  // The container catches click/mousedown to keep the editor's selection alive while the
  // user is interacting with the popup. The actual interactive items inside are real
  // <button>s with full keyboard support — this wrapper just stops bubbling.
  return (
    <div
      ref={containerRef}
      role="listbox"
      className="relative max-h-80 w-72 overflow-y-auto rounded-md border-[0.5px] border-strong bg-surface-1 px-2 py-2 text-13 shadow-raised-200"
      style={{ zIndex: 100 }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      // oxlint-disable-next-line jsx-a11y/click-events-have-key-events -- container only stops bubbling; keyboard activation flows through the inner <button>s.
    >
      {isLoading ? (
        <div className="px-1 py-2 text-center text-placeholder">Searching pages...</div>
      ) : items.length === 0 ? (
        <div className="px-1 py-2 text-center text-placeholder">
          {query ? `No pages match "${query}"` : "Start typing to search pages..."}
        </div>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {items.map((item, index) => {
            const isSelected = index === selectedIndex;
            return (
              <li key={item.id}>
                <button
                  id={`wiki-link-item-${index}`}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 truncate rounded-sm px-2 py-1.5 text-left text-secondary hover:bg-layer-1-hover",
                    { "bg-layer-1-hover": isSelected }
                  )}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    selectItem(index);
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <span className="grid size-4 flex-shrink-0 place-items-center text-tertiary">{item.icon}</span>
                  <span className="grow truncate">{item.name || "Untitled"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
});

WikiLinkPopup.displayName = "WikiLinkPopup";
