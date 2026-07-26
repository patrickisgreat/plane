/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo } from "react";
import { FilePlus2 } from "lucide-react";
import type { TEditorCommands, TSlashCommandAdditionalOption } from "@plane/editor";
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
// plane web hooks
import type { EPageStoreType } from "@/hooks/store";
import { usePageStore } from "@/hooks/store";
// store types
import type { TPageInstance } from "@/store/pages/base-page";

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

/**
 * Builds a slash-command item that creates a new sub-page of the page currently being
 * edited and inserts a live page-mention link at the cursor where `/` was typed.
 *
 * The editor package can't reach the MobX store directly — we close over `createPage`
 * and the parent's `page` instance here in the consumer.
 */
export const useSubPageSlashCommand = (
  page: TPageInstance,
  storeType: EPageStoreType
): TSlashCommandAdditionalOption[] => {
  const { createPage } = usePageStore(storeType);
  return useMemo<TSlashCommandAdditionalOption[]>(() => {
    if (!page.id) return [];
    const parentId = page.id;
    const parentAccess = page.access;
    return [
      {
        commandKey: "sub-page" as TEditorCommands,
        key: "sub-page",
        title: "Sub-page",
        description: "Create a new sub-page and link it here",
        searchTerms: ["page", "child", "sub", "subpage", "wiki", "link", "ref", "reference"],
        icon: <FilePlus2 className="size-3.5" />,
        section: "general",
        // Place it right after "to-do-list" so it sits among other content-creation commands.
        pushAfter: "to-do-list",
        command: ({ editor, range }) => {
          // Tiptap's command callback can't be async. Strip the `/sub` query from the doc
          // immediately so the user doesn't see it lingering during the round-trip, then
          // insert the page-mention once the create resolves.
          editor.chain().focus().deleteRange(range).run();
          const insertPos = range.from;
          void createPage({ name: "", parent: parentId, access: parentAccess })
            .then((newPage) => {
              if (newPage?.id) {
                editor
                  .chain()
                  .focus()
                  .insertContentAt(insertPos, { type: "pageMention", attrs: { pageId: newPage.id } })
                  .run();
              }
              return newPage;
            })
            .catch((error: unknown) => {
              const apiMessage = extractApiErrorMessage(error);
              setToast({
                type: TOAST_TYPE.ERROR,
                title: "Couldn't create sub-page",
                message: apiMessage ?? "Please try again. If it keeps failing, check the page list and reload.",
              });
              return undefined;
            });
        },
      },
    ];
  }, [page.id, page.access, createPage]);
};
