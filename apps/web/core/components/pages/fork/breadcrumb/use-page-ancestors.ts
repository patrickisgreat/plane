/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane web hooks
import type { EPageStoreType } from "@/hooks/store";
import { usePageStore } from "@/hooks/store";
// store types
import type { TPageInstance } from "@/store/pages/base-page";

const MAX_DEPTH = 32;

/**
 * Walks the page parent chain and returns ancestors ordered root → immediate parent.
 * The current page itself is NOT included. Cycles or missing ancestors short-circuit.
 */
export const usePageAncestors = (storeType: EPageStoreType, pageId: string | undefined): TPageInstance[] => {
  const { data } = usePageStore(storeType);
  if (!pageId || !data) return [];

  const pages = data as Record<string, TPageInstance>;
  const start = pages[pageId];
  if (!start?.parent) return [];

  // Build the chain in walk order (immediate parent → root) then mirror it for the caller.
  const reversed: TPageInstance[] = [];
  const seen = new Set<string>([pageId]);
  let cursorId: string | null | undefined = start.parent;
  let depth = 0;

  while (cursorId && depth < MAX_DEPTH) {
    if (seen.has(cursorId)) break;
    const node: TPageInstance | undefined = pages[cursorId];
    if (!node) break;
    reversed.push(node);
    seen.add(cursorId);
    cursorId = node.parent ?? null;
    depth += 1;
  }

  const ancestors: TPageInstance[] = [];
  for (let i = reversed.length - 1; i >= 0; i--) {
    const node = reversed[i];
    if (node) ancestors.push(node);
  }
  return ancestors;
};
