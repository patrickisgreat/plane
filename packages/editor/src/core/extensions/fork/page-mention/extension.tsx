/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
// types
import type { TPageMentionHandler } from "./types";
// node view
import { PageMentionNodeView } from "./node-view";

export type TPageMentionExtensionOptions = {
  renderComponent: TPageMentionHandler["renderComponent"];
  getPageDetails: TPageMentionHandler["getPageDetails"];
};

const TAG = "page-mention";

/**
 * Inline atomic Tiptap node representing a live reference to a Plane page.
 *
 * Persisted as `<a data-page-mention="true" data-page-id="<uuid>" href="<route>">label</a>`
 * so the rendered HTML degrades gracefully (a real link with the last-known title) when
 * loaded outside the editor or as exported markup.
 *
 * Inside the editor, the NodeView re-renders reactively from the consumer-supplied
 * `renderComponent`, so the displayed label always reflects the page's current name.
 */
export const PageMentionExtension = (handler: TPageMentionHandler) =>
  Node.create<TPageMentionExtensionOptions>({
    name: "pageMention",
    group: "inline",
    inline: true,
    atom: true,
    selectable: true,
    draggable: false,
    // Outrank the CustomLink mark when both could match an `<a>` element on parse.
    priority: 1001,

    addOptions() {
      return {
        renderComponent: handler.renderComponent,
        getPageDetails: handler.getPageDetails,
      };
    },

    addAttributes() {
      return {
        pageId: {
          default: null,
          parseHTML: (element) => element.getAttribute("data-page-id"),
          renderHTML: (attrs) => (attrs.pageId ? { "data-page-id": attrs.pageId } : {}),
        },
      };
    },

    parseHTML() {
      return [
        { tag: `${TAG}` },
        // also accept regular anchors that we authored — keeps existing static
        // links from earlier PRs interoperable when the doc is re-saved.
        { tag: "a[data-page-mention][data-page-id]" },
      ];
    },

    renderHTML({ node, HTMLAttributes }) {
      const pageId: string | null = node.attrs.pageId ?? null;
      const details = pageId ? this.options.getPageDetails?.(pageId) : undefined;
      const label = details?.name && details.name.trim().length > 0 ? details.name : "Untitled";
      const href = details?.href ?? "#";
      return [
        "a",
        mergeAttributes(HTMLAttributes, {
          href,
          "data-page-mention": "true",
          "data-page-id": pageId,
          class: "page-mention",
        }),
        label,
      ];
    },

    renderText({ node }) {
      const pageId: string | null = node.attrs.pageId ?? null;
      const details = pageId ? this.options.getPageDetails?.(pageId) : undefined;
      return details?.name && details.name.trim().length > 0 ? details.name : "Untitled";
    },

    addNodeView() {
      return ReactNodeViewRenderer(PageMentionNodeView);
    },
  });
