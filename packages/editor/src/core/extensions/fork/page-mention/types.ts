/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TPageMentionDetails = {
  name: string;
  href: string;
};

/**
 * Consumer-supplied handler for rendering a live page-mention node.
 *
 * The editor package is store-agnostic. The web app provides:
 *   - renderComponent: a React component that knows how to look up the page from its
 *     MobX store and re-render reactively when the page is renamed.
 *   - getPageDetails: a sync read used for HTML serialization (so persisted markup
 *     still has a sensible label + href even when JS isn't running, e.g. raw export).
 */
export type TPageMentionHandler = {
  renderComponent: (props: { pageId: string }) => React.ReactNode;
  getPageDetails: (pageId: string) => TPageMentionDetails | undefined;
};
