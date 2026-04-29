/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { ChevronRight, Plus } from "lucide-react";
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
import { getPageName } from "@plane/utils";
import { useAppRouter } from "@/hooks/use-app-router";
// plane web hooks
import type { EPageStoreType } from "@/plane-web/hooks/store";
import { usePageStore } from "@/plane-web/hooks/store";
// store types
import type { TPageInstance } from "@/store/pages/base-page";
// fork: queue a page-mention insert so the parent's editor drains it next time it mounts.
import { enqueuePendingChildLink } from "../page-mention";
// local imports
import { usePageAncestors } from "./use-page-ancestors";

const extractApiErrorMessage = (error: unknown): string | undefined => {
  if (typeof error !== "object" || error === null) return undefined;
  for (const key of ["error", "detail", "message"] as const) {
    if (key in error) {
      const value = (error as Record<string, unknown>)[key];
      if (typeof value === "string" && value.length > 0) return value;
    }
  }
  return undefined;
};

type Props = {
  page: TPageInstance;
  storeType: EPageStoreType;
};

export const PageBreadcrumb = observer(function PageBreadcrumb(props: Props) {
  const { page, storeType } = props;
  const ancestors = usePageAncestors(storeType, page.id);
  const { createPage } = usePageStore(storeType);
  const router = useAppRouter();
  const params = useParams();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateChild = async () => {
    if (isCreating || !page.id) return;
    setIsCreating(true);
    try {
      const newPage = await createPage({ name: "", parent: page.id, access: page.access });
      if (!newPage?.id) return;

      const workspaceSlug = params.workspaceSlug?.toString();
      const projectId = params.projectId?.toString();
      if (workspaceSlug && projectId && page.id) {
        // Navigate the user to the new child so they can rename it via the title input.
        // The parent's body link is added when the parent's editor next mounts (drains
        // the queue) — page-mention atom nodes can't be renamed inline, so previously
        // leaving the user on the parent left them with an unrenameable "Untitled" link.
        enqueuePendingChildLink({ parentId: page.id, childId: newPage.id });
        router.push(`/${workspaceSlug}/projects/${projectId}/pages/${newPage.id}`);
      }
    } catch (error) {
      const apiMessage = extractApiErrorMessage(error);
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Couldn't create sub-page",
        message: apiMessage ?? "Please try again. If it keeps failing, check the page list and reload.",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex h-7 shrink-0 items-center gap-1 px-page-x text-12 text-tertiary">
      {ancestors.length > 0 ? (
        <nav aria-label="Page hierarchy" className="flex min-w-0 items-center gap-1">
          {ancestors.map((ancestor, index) => {
            const isLast = index === ancestors.length - 1;
            const key = ancestor.id ?? `ancestor-${index}-${ancestor.name ?? ""}`;
            return (
              <span key={key} className="flex min-w-0 items-center gap-1">
                <a
                  href={ancestor.getRedirectionLink()}
                  className="max-w-[16ch] truncate text-tertiary hover:text-primary hover:underline"
                  title={getPageName(ancestor.name)}
                >
                  {getPageName(ancestor.name) || "Untitled"}
                </a>
                {!isLast && <ChevronRight className="size-3 shrink-0 text-placeholder" aria-hidden />}
              </span>
            );
          })}
        </nav>
      ) : (
        // Empty placeholder so the create button stays right-aligned on root pages.
        <span aria-hidden />
      )}
      <span className="grow" />
      <button
        type="button"
        onClick={handleCreateChild}
        disabled={isCreating}
        className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-12 text-tertiary transition-colors hover:bg-layer-transparent-hover hover:text-primary disabled:cursor-progress disabled:opacity-60"
        aria-label="New sub-page"
        title="New sub-page under this page"
      >
        <Plus className="size-3.5" />
        <span>Sub-page</span>
      </button>
    </div>
  );
});
