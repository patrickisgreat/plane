/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Extension } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import SuggestionExtension from "@tiptap/suggestion";
import type { SuggestionOptions } from "@tiptap/suggestion";
// helpers
import { updateFloatingUIFloaterPosition } from "@/helpers/floating-ui";
import type { CommandListInstance } from "@/helpers/tippy";
import { DROPDOWN_NAVIGATION_KEYS } from "@/helpers/tippy";
// local imports
import type { WikiLinkPopupProps } from "./popup";
import { WikiLinkPopup } from "./popup";
import type { TWikiLinkHandler, TWikiLinkSuggestion } from "./types";

const WIKI_LINK_TRIGGER = "[[";

const renderWikiLinkPopup =
  (handler: TWikiLinkHandler): SuggestionOptions<TWikiLinkSuggestion, TWikiLinkSuggestion>["render"] =>
  () => {
    let component: ReactRenderer<CommandListInstance, WikiLinkPopupProps> | null = null;
    // oxlint-disable-next-line unicorn/consistent-function-scoping
    const noopCleanup = () => {};
    let cleanup: () => void = noopCleanup;

    const handleClose = () => {
      component?.destroy();
      component = null;
      cleanup();
    };

    return {
      onStart: (props) => {
        component = new ReactRenderer<CommandListInstance, WikiLinkPopupProps>(WikiLinkPopup, {
          props: {
            ...props,
            searchPages: handler.searchPages,
            onClose: handleClose,
          } satisfies WikiLinkPopupProps,
          editor: props.editor,
          className: "fixed z-[100]",
        });
        if (!props.clientRect) return;
        const element = component.element as HTMLElement;
        cleanup = updateFloatingUIFloaterPosition(props.editor, element).cleanup;
      },
      onUpdate: (props) => {
        if (!component || !component.element) return;
        component.updateProps(props);
        if (!props.clientRect) return;
        cleanup();
        cleanup = updateFloatingUIFloaterPosition(props.editor, component.element as HTMLElement).cleanup;
      },
      onKeyDown: ({ event }) => {
        if ([...DROPDOWN_NAVIGATION_KEYS, "Escape"].includes(event.key)) {
          event.preventDefault();
          event.stopPropagation();
        }
        if (event.key === "Escape") {
          handleClose();
          return true;
        }
        return component?.ref?.onKeyDown({ event }) ?? false;
      },
      onExit: () => {
        component?.element.remove();
        handleClose();
      },
    };
  };

/**
 * Wiki-style `[[Page]]` autocomplete. Typing `[[` opens a popup of pages in the current
 * project; selecting one inserts a live page-mention node (the same NodeView powered by
 * PR #12 — so the link's label tracks the target page's current title).
 *
 * Currently links to existing pages only. Creating a new page from a missing-match query
 * is a future follow-up; users can still hit `/sub-page` to create + link in one shot.
 */
export const WikiLinkExtension = (handler: TWikiLinkHandler) =>
  Extension.create({
    name: "forkWikiLink",
    addProseMirrorPlugins() {
      return [
        SuggestionExtension<TWikiLinkSuggestion, TWikiLinkSuggestion>({
          editor: this.editor,
          char: WIKI_LINK_TRIGGER,
          startOfLine: false,
          allowSpaces: true,
          // Items isn't actually consulted by the popup — the popup runs its own
          // debounced searchPages call so typing feels snappier. Returning a
          // non-undefined value here is required to keep the suggestion plugin happy.
          items: () => [],
          command: ({ editor, range, props }) => {
            editor
              .chain()
              .focus()
              .deleteRange(range)
              .insertContentAt(range.from, {
                type: "pageMention",
                attrs: { pageId: props.id },
              })
              .run();
          },
          render: renderWikiLinkPopup(handler),
        }),
      ];
    },
  });
