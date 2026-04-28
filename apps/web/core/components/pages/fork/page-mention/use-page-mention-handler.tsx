/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo } from "react";
import { observer } from "mobx-react";
import type { TPageMentionDetails, TPageMentionHandler } from "@plane/editor";
import { getPageName } from "@plane/utils";
// plane web hooks
import type { EPageStoreType } from "@/plane-web/hooks/store";
import { usePageStore } from "@/plane-web/hooks/store";

const PageMentionLink = observer(function PageMentionLink({
  pageId,
  storeType,
}: {
  pageId: string;
  storeType: EPageStoreType;
}) {
  const { getPageById } = usePageStore(storeType);
  const page = getPageById(pageId);
  const label = getPageName(page?.name) || "Untitled";
  const href = page?.getRedirectionLink() ?? "#";
  return (
    <a href={href} className="text-accent-primary hover:underline" data-page-id={pageId}>
      {label}
    </a>
  );
});

/**
 * Builds the pageMentionHandler the editor needs. The render component is wrapped in
 * mobx-react's observer so it re-renders whenever the referenced page's name changes
 * in the store — fixing the "Untitled forever" staleness from earlier static-link PRs.
 */
export const usePageMentionHandler = (storeType: EPageStoreType): TPageMentionHandler => {
  const { getPageById } = usePageStore(storeType);
  return useMemo<TPageMentionHandler>(
    () => ({
      renderComponent: ({ pageId }) => <PageMentionLink pageId={pageId} storeType={storeType} />,
      getPageDetails: (pageId: string): TPageMentionDetails | undefined => {
        const page = getPageById(pageId);
        if (!page) return undefined;
        return {
          name: getPageName(page.name) || "Untitled",
          href: page.getRedirectionLink() ?? "#",
        };
      },
    }),
    [storeType, getPageById]
  );
};
