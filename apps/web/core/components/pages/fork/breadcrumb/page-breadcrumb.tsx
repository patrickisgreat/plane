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
// plane web hooks
import type { EPageStoreType } from "@/plane-web/hooks/store";
import { usePageStore } from "@/plane-web/hooks/store";
// store types
import type { TPageInstance } from "@/store/pages/base-page";
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
  const params = useParams();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateChild = async () => {
    if (isCreating || !page.id) return;
    setIsCreating(true);
    try {
      const newPage = await createPage({ name: "", parent: page.id, access: page.access });
      const workspaceSlug = params.workspaceSlug?.toString();
      const projectId = params.projectId?.toString();
      if (!newPage?.id || !workspaceSlug || !projectId) return;

      const childUrl = `/${workspaceSlug}/projects/${projectId}/pages/${newPage.id}`;
      // fork: insert a static link to the new child in the parent's body so the parent
      // surfaces its children inline. Phase 4 will replace this with a live page-mention
      // node that re-renders the label when the child is renamed.
      const childLabel = getPageName(newPage.name) || "New sub-page";
      const editor = page.editor.editorRef;
      let insertedIntoBody = false;
      if (editor) {
        const safeLabel = childLabel.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        // Always anchor the insertion at the end of the document. insertText is a no-op when
        // the editor has no active selection, which is the case as soon as the user clicks the
        // breadcrumb button (DOM focus moves to the button). Focusing "end" first guarantees
        // the link lands somewhere predictable regardless of where the user was previously.
        editor.focus("end");
        editor.insertText(`<p><a href="${childUrl}">${safeLabel}</a></p>`, true);
        insertedIntoBody = true;
      }
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Sub-page created",
        message: insertedIntoBody
          ? "A link to the new page was added at the end of this page."
          : "Open it from the page tree on the left.",
      });
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
