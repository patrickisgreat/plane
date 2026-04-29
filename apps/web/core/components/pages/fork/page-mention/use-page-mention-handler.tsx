/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo } from "react";
import { observer } from "mobx-react";
import type { TPageMentionDetails, TPageMentionHandler } from "@plane/editor";
import { cn, getPageName } from "@plane/utils";
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

  // Page no longer exists in the store (deleted, or never loaded). Render as inert text
  // with a strikethrough so users understand the reference is broken — clicking it would
  // 404 on the page route anyway, so we don't render an <a>.
  if (!page) {
    return (
      <span
        className="decoration-tertiary text-tertiary line-through"
        data-page-id={pageId}
        title="This page no longer exists."
      >
        {label} <span className="text-placeholder no-underline">(deleted)</span>
      </span>
    );
  }

  const isArchived = !!page.archived_at;
  const href = page.getRedirectionLink() ?? "#";

  return (
    <a
      href={href}
      data-page-id={pageId}
      className={cn("underline-offset-2 hover:underline", isArchived ? "text-tertiary italic" : "text-accent-primary")}
      title={isArchived ? "This page is archived. Click to open it from the Archived tab." : undefined}
    >
      {label}
      {isArchived && <span className="ml-1 text-placeholder no-underline">(archived)</span>}
    </a>
  );
});

/**
 * Builds the pageMentionHandler the editor needs. The render component is wrapped in
 * mobx-react's observer so it re-renders whenever the referenced page's name OR
 * archive state changes in the store.
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
