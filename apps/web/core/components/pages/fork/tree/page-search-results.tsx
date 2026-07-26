/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { useTranslation } from "@plane/i18n";
import { Logo } from "@plane/propel/emoji-icon-picker";
import { EmptyStateDetailed } from "@plane/propel/empty-state";
import { PageIcon } from "@plane/propel/icons";
import type { TPageNavigationTabs } from "@plane/types";
import { getPageName } from "@plane/utils";
// plane web hooks
import type { EPageStoreType } from "@/hooks/store";
import { usePageStore } from "@/hooks/store";
import useDebounce from "@/hooks/use-debounce";
// services
import { ForkPageSearchService } from "@/services/page/fork-page-search.service";
// store types
import type { TPageInstance } from "@/store/pages/base-page";
// local imports
import { matchesTab } from "./use-page-tree";

const forkPageSearchService = new ForkPageSearchService();

type Props = {
  pageType: TPageNavigationTabs;
  storeType: EPageStoreType;
};

/**
 * Flat search-result list rendered in place of the tree while a search query is active.
 * Title matches come from the client store instantly; body-text matches arrive from the
 * fork /pages/search/ endpoint (debounced) and are appended with a context snippet.
 */
export const PageSearchResults = observer(function PageSearchResults(props: Props) {
  const { pageType, storeType } = props;
  const { t } = useTranslation();
  const params = useParams();
  const workspaceSlug = params.workspaceSlug?.toString();
  const projectId = params.projectId?.toString();
  const { filters, getCurrentProjectFilteredPageIdsByTab, getPageById } = usePageStore(storeType);

  const query = filters.searchQuery.trim();
  const debouncedQuery = useDebounce(query, 300);
  const { data: serverResults, isLoading } = useSWR(
    workspaceSlug && projectId && debouncedQuery ? `FORK_PAGE_SEARCH_${projectId}_${debouncedQuery}` : null,
    workspaceSlug && projectId && debouncedQuery
      ? () => forkPageSearchService.search(workspaceSlug, projectId, debouncedQuery)
      : null
  );

  // Instant title matches (store computed already scopes to project + tab + filters).
  const titleMatchIds = getCurrentProjectFilteredPageIdsByTab(pageType) ?? [];

  // Body-text matches: skip pages already shown as title matches, keep the active tab's pages.
  const snippetByPageId: Record<string, string> = {};
  const contentMatchIds: string[] = [];
  for (const result of serverResults ?? []) {
    if (titleMatchIds.includes(result.id)) continue;
    const page = getPageById(result.id);
    if (!page || !matchesTab(page, pageType)) continue;
    if (result.snippet) snippetByPageId[result.id] = result.snippet;
    contentMatchIds.push(result.id);
  }

  const allIds = [...titleMatchIds, ...contentMatchIds];
  if (allIds.length === 0 && !isLoading)
    return (
      <EmptyStateDetailed
        assetKey="search"
        title={t("common_empty_state.search.title")}
        description={t("common_empty_state.search.description")}
      />
    );

  return (
    <div className="flex h-full flex-col gap-0.5 overflow-y-auto py-1">
      {allIds.map((pageId) => (
        <PageSearchResultRow key={pageId} pageId={pageId} snippet={snippetByPageId[pageId]} storeType={storeType} />
      ))}
      {isLoading && <div className="shrink-0 px-2 py-1.5 text-12 text-tertiary">Searching page contents…</div>}
    </div>
  );
});

type RowProps = {
  pageId: string;
  snippet: string | undefined;
  storeType: EPageStoreType;
};

const PageSearchResultRow = observer(function PageSearchResultRow(props: RowProps) {
  const { pageId, snippet, storeType } = props;
  const { getPageById } = usePageStore(storeType);
  const page = getPageById(pageId);
  if (!page) return null;

  const ancestorPath = buildAncestorPath(page, getPageById);

  return (
    <a
      href={page.getRedirectionLink()}
      className="group flex shrink-0 flex-col gap-0.5 rounded-sm px-2 py-1.5 hover:bg-layer-transparent-hover"
    >
      <span className="flex items-center gap-1.5 text-13">
        <span className="flex size-4 shrink-0 items-center justify-center">
          {page.logo_props?.in_use ? (
            <Logo logo={page.logo_props} size={14} type="lucide" />
          ) : (
            <PageIcon className="size-3.5 text-tertiary" />
          )}
        </span>
        <span className="truncate text-primary">{getPageName(page.name)}</span>
        {ancestorPath && <span className="truncate text-12 text-tertiary">{ancestorPath}</span>}
      </span>
      {snippet && <span className="line-clamp-2 ps-[22px] text-12 text-tertiary">{snippet}</span>}
    </a>
  );
});

const buildAncestorPath = (
  page: TPageInstance,
  getPageById: (id: string) => TPageInstance | undefined
): string | null => {
  const names: string[] = [];
  let cursorId = page.parent ?? null;
  const seen = new Set<string>();
  while (cursorId && !seen.has(cursorId)) {
    seen.add(cursorId);
    const ancestor = getPageById(cursorId);
    if (!ancestor) break;
    names.unshift(getPageName(ancestor.name));
    cursorId = ancestor.parent ?? null;
  }
  return names.length > 0 ? names.join(" / ") : null;
};
