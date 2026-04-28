/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { Logo } from "@plane/propel/emoji-icon-picker";
import { PageIcon } from "@plane/propel/icons";
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
import { getPageName } from "@plane/utils";
import { useAppRouter } from "@/hooks/use-app-router";
// plane web hooks
import type { EPageStoreType } from "@/plane-web/hooks/store";
import { usePage, usePageStore } from "@/plane-web/hooks/store";

const INDENT_PER_LEVEL = 16;

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
  pageId: string;
  depth: number;
  childIdsByParent: Record<string, string[]>;
  storeType: EPageStoreType;
};

export const PageTreeRow = observer(function PageTreeRow(props: Props) {
  const { pageId, depth, childIdsByParent, storeType } = props;
  const page = usePage({ pageId, storeType });
  const { createPage } = usePageStore(storeType);
  const router = useAppRouter();
  const params = useParams();
  const [expanded, setExpanded] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  if (!page) return null;
  const { name, logo_props, access, getRedirectionLink } = page;
  const childIds = childIdsByParent[pageId] ?? [];
  const hasChildren = childIds.length > 0;

  const handleCreateChild = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isCreating) return;
    setIsCreating(true);
    setExpanded(true);
    try {
      // Pass an explicit empty name; the create serializer expects the field present.
      const newPage = await createPage({ name: "", parent: pageId, access });
      const workspaceSlug = params.workspaceSlug?.toString();
      const projectId = params.projectId?.toString();
      if (newPage?.id && workspaceSlug && projectId) {
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
        <a href={getRedirectionLink()} className="max-w-full min-w-0 truncate text-primary" title={getPageName(name)}>
          {getPageName(name)}
        </a>
        <button
          type="button"
          onClick={handleCreateChild}
          disabled={isCreating}
          className="flex size-5 shrink-0 items-center justify-center rounded text-tertiary opacity-0 transition-opacity group-hover:opacity-100 hover:bg-layer-transparent-hover hover:text-primary focus:opacity-100 disabled:cursor-progress disabled:opacity-100"
          aria-label="New sub-page"
          title="New sub-page"
        >
          <Plus className="size-3.5" />
        </button>
        {/* Spacer fills the remaining row width so hover bg covers the whole row. */}
        <div className="grow" />
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
