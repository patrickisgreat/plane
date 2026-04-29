/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type React from "react";

export type TWikiLinkSuggestion = {
  /** UUID of the page — used as the pageMention node's pageId attribute. */
  id: string;
  name: string;
  icon?: React.ReactNode;
};

/**
 * Consumer-supplied handler for the `[[Page]]` autocomplete extension.
 *
 * Editor package is store-agnostic — the web app provides searchPages by reading the
 * project's pages from the MobX store and fuzzy-matching them against the user's query.
 */
export type TWikiLinkHandler = {
  searchPages: (query: string) => Promise<TWikiLinkSuggestion[]>;
};
