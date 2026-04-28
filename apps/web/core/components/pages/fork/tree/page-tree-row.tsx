/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Logo } from "@plane/propel/emoji-icon-picker";
import { PageIcon } from "@plane/propel/icons";
import { getPageName } from "@plane/utils";
// plane web hooks
import type { EPageStoreType } from "@/plane-web/hooks/store";
import { usePage } from "@/plane-web/hooks/store";

const INDENT_PER_LEVEL = 16;

type Props = {
  pageId: string;
  depth: number;
  childIdsByParent: Record<string, string[]>;
  storeType: EPageStoreType;
};

export const PageTreeRow = observer(function PageTreeRow(props: Props) {
  const { pageId, depth, childIdsByParent, storeType } = props;
  const page = usePage({ pageId, storeType });
  const [expanded, setExpanded] = useState(true);

  if (!page) return null;
  const { name, logo_props, getRedirectionLink } = page;
  const childIds = childIdsByParent[pageId] ?? [];
  const hasChildren = childIds.length > 0;

  return (
    <>
      <div
        className="group flex h-8 items-center gap-1 rounded-sm px-1 text-13 hover:bg-layer-transparent-hover"
        style={{ paddingInlineStart: depth * INDENT_PER_LEVEL + 4 }}
      >
        <button
          type="button"
          onClick={() => hasChildren && setExpanded((v) => !v)}
          className={`flex size-4 shrink-0 items-center justify-center rounded text-tertiary ${
            hasChildren ? "hover:text-primary" : "invisible"
          }`}
          aria-label={expanded ? "Collapse children" : "Expand children"}
          tabIndex={hasChildren ? 0 : -1}
        >
          {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>
        <span className="flex size-4 shrink-0 items-center justify-center">
          {logo_props?.in_use ? (
            <Logo logo={logo_props} size={14} type="lucide" />
          ) : (
            <PageIcon className="size-3.5 text-tertiary" />
          )}
        </span>
        <a href={getRedirectionLink()} className="grow truncate text-primary" title={getPageName(name)}>
          {getPageName(name)}
        </a>
      </div>
      {hasChildren && expanded && (
        <>
          {childIds.map((childId) => (
            <PageTreeRow
              key={childId}
              pageId={childId}
              depth={depth + 1}
              childIdsByParent={childIdsByParent}
              storeType={storeType}
            />
          ))}
        </>
      )}
    </>
  );
});
