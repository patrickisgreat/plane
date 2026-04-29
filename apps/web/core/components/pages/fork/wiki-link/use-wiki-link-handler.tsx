/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo } from "react";
import { FileText } from "lucide-react";
import type { TWikiLinkHandler, TWikiLinkSuggestion } from "@plane/editor";
import { getPageName } from "@plane/utils";
// plane web hooks
import type { EPageStoreType } from "@/plane-web/hooks/store";
import { usePageStore } from "@/plane-web/hooks/store";
// store types
import type { TPageInstance } from "@/store/pages/base-page";

const MAX_RESULTS = 12;

const buildSuggestion = (page: TPageInstance): TWikiLinkSuggestion => ({
  id: page.id ?? "",
  name: getPageName(page.name) || "Untitled",
  icon: <FileText className="size-3.5" />,
});

/**
 * Builds the wikiLinkHandler the editor's `[[Page]]` extension needs. Searches the project's
 * pages from the local store — no extra fetch — and returns top matches. Excludes archived
 * pages and the page being edited (you can't link to yourself in any useful way).
 */
export const useWikiLinkHandler = (storeType: EPageStoreType, currentPageId: string | undefined): TWikiLinkHandler => {
  const { data } = usePageStore(storeType);
  return useMemo<TWikiLinkHandler>(
    () => ({
      searchPages: async (rawQuery: string) => {
        const query = rawQuery.trim().toLowerCase();
        const pages = Object.values((data as Record<string, TPageInstance>) ?? {});
        const filtered = pages.filter((p) => {
          if (!p?.id) return false;
          if (p.id === currentPageId) return false;
          if (p.archived_at) return false;
          if (!query) return true;
          return getPageName(p.name).toLowerCase().includes(query);
        });
        // Rank: exact prefix matches first, then everything else by name. Cap to MAX_RESULTS.
        if (query) {
          filtered.sort((a, b) => {
            const aName = getPageName(a.name).toLowerCase();
            const bName = getPageName(b.name).toLowerCase();
            const aStarts = aName.startsWith(query);
            const bStarts = bName.startsWith(query);
            if (aStarts !== bStarts) return aStarts ? -1 : 1;
            return aName < bName ? -1 : aName > bName ? 1 : 0;
          });
        } else {
          filtered.sort((a, b) => (getPageName(a.name).toLowerCase() < getPageName(b.name).toLowerCase() ? -1 : 1));
        }
        return filtered.slice(0, MAX_RESULTS).map(buildSuggestion);
      },
    }),
    [data, currentPageId]
  );
};
