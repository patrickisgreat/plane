/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
// extension types
import type { TPageMentionExtensionOptions } from "./extension";

export function PageMentionNodeView(props: NodeViewProps) {
  const { extension, node } = props;
  const pageId: string | null = node.attrs.pageId ?? null;
  const options = extension.options as TPageMentionExtensionOptions;

  return (
    <NodeViewWrapper as="span" className="page-mention inline-flex" data-page-id={pageId ?? ""}>
      {pageId ? options.renderComponent({ pageId }) : <span className="text-tertiary">Untitled</span>}
    </NodeViewWrapper>
  );
}
