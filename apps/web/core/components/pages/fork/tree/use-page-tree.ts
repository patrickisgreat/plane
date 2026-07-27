/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TPageNavigationTabs } from "@plane/types";
import { getPageName } from "@plane/utils";
// plane web hooks
import type { EPageStoreType } from "@/hooks/store";
import { usePageStore } from "@/hooks/store";
// store
import type { TPageInstance } from "@/store/pages/base-page";

export type TPageTree = {
  rootIds: string[];
  childIdsByParent: Record<string, string[]>;
};

export const matchesTab = (page: TPageInstance, tab: TPageNavigationTabs): boolean => {
  const archived = !!page.archived_at;
  if (tab === "archived") return archived;
  if (archived) return false;
  if (tab === "private") return page.access === 1;
  return page.access === 0;
};

export const usePageTree = (storeType: EPageStoreType, pageType: TPageNavigationTabs): TPageTree => {
  const { data, getCurrentProjectFilteredPageIdsByTab } = usePageStore(storeType);

  // The flat-list computed already applies the active project + search + filter chain to roots.
  // Reusing it means any future filter additions cascade into the tree for free.
  const rootIds = getCurrentProjectFilteredPageIdsByTab(pageType) ?? [];

  // Group children by parent. O(n) on every render — cheap until we routinely have thousands
  // of pages, at which point this should move to a computedFn on the store.
  const pages = Object.values((data as Record<string, TPageInstance>) ?? {});
  const childIdsByParent: Record<string, string[]> = {};
  for (const page of pages) {
    if (!page?.id || !page.parent) continue;
    if (!matchesTab(page, pageType)) continue;
    const list = childIdsByParent[page.parent] ?? [];
    list.push(page.id);
    childIdsByParent[page.parent] = list;
  }

  for (const parentId of Object.keys(childIdsByParent)) {
    const sorted = Array.from(childIdsByParent[parentId] ?? []);
    sorted.sort((a, b) => {
      const nameA = getPageName(data?.[a]?.name).toLowerCase();
      const nameB = getPageName(data?.[b]?.name).toLowerCase();
      if (nameA !== nameB) return nameA < nameB ? -1 : 1;
      return a < b ? -1 : 1;
    });
    childIdsByParent[parentId] = sorted;
  }

  return { rootIds, childIdsByParent };
};
