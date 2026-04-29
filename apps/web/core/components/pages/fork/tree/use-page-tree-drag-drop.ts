/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback } from "react";
import { runInAction } from "mobx";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
// plane web hooks
import type { EPageStoreType } from "@/plane-web/hooks/store";
import { usePageStore } from "@/plane-web/hooks/store";
// store types
import type { TPageInstance } from "@/store/pages/base-page";

export const PAGE_TREE_DRAG_TYPE = "fork.page-tree.row";

export type TPageTreeDragData = {
  type: typeof PAGE_TREE_DRAG_TYPE;
  pageId: string;
};

export const isPageTreeDragData = (data: unknown): data is TPageTreeDragData =>
  typeof data === "object" &&
  data !== null &&
  (data as { type?: unknown }).type === PAGE_TREE_DRAG_TYPE &&
  typeof (data as { pageId?: unknown }).pageId === "string";

/**
 * Builds a `reparent(draggedId, newParentId | null)` callback that:
 *   1. Refuses cycles — you can't make a page a child of one of its own descendants.
 *   2. Optimistically updates the dragged page's `parent` in the store so the tree re-renders.
 *   3. Calls the page service to persist; rolls the store back and toasts if the API rejects.
 *
 * `newParentId === null` promotes the page to the project root.
 */
export const usePageTreeDragDrop = (storeType: EPageStoreType) => {
  const { getPageById } = usePageStore(storeType);

  return useCallback(
    async (draggedId: string, newParentId: string | null): Promise<void> => {
      if (draggedId === newParentId) return;
      const dragged = getPageById(draggedId);
      if (!dragged) return;
      if ((dragged.parent ?? null) === (newParentId ?? null)) return; // no-op

      // Cycle check: walk up from newParentId; if we reach draggedId, drop is illegal.
      if (newParentId) {
        let cursorId: string | null = newParentId;
        const seen = new Set<string>();
        while (cursorId) {
          if (cursorId === draggedId) {
            setToast({
              type: TOAST_TYPE.ERROR,
              title: "Can't move there",
              message: "A page can't be made a child of one of its own descendants.",
            });
            return;
          }
          if (seen.has(cursorId)) break; // defensive
          seen.add(cursorId);
          const node: TPageInstance | undefined = getPageById(cursorId);
          cursorId = node?.parent ?? null;
        }
      }

      const previousParent = dragged.parent ?? null;
      runInAction(() => {
        dragged.parent = newParentId;
      });
      try {
        // Bypass the BasePage.update wrapper — its `value || undefined` guard drops a
        // null parent, which we need to preserve on a "promote to root" drop. Talk to the
        // service directly so the PATCH actually carries `parent: null`.
        await dragged.services.update({ parent: newParentId });
      } catch (error) {
        runInAction(() => {
          dragged.parent = previousParent;
        });
        const message =
          typeof error === "object" &&
          error !== null &&
          "error" in error &&
          typeof (error as { error: unknown }).error === "string"
            ? (error as { error: string }).error
            : "Couldn't move the page. Please try again.";
        setToast({
          type: TOAST_TYPE.ERROR,
          title: "Move failed",
          message,
        });
      }
    },
    [getPageById]
  );
};
