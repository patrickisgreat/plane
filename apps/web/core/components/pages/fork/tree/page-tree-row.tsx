/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { draggable, dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { ArchiveRestoreIcon, ChevronDown, ChevronRight, GripVertical, Plus } from "lucide-react";
import { Logo } from "@plane/propel/emoji-icon-picker";
import { ArchiveIcon, PageIcon, TrashIcon } from "@plane/propel/icons";
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
import { AlertModalCore } from "@plane/ui";
import { cn, getPageName } from "@plane/utils";
import { useAppRouter } from "@/hooks/use-app-router";
import { usePageOperations } from "@/hooks/use-page-operations";
// upstream modals
import { DeletePageModal } from "@/components/pages/modals/delete-page-modal";
// fork: queue a page-mention insert for the parent that the parent's editor will drain on mount.
import { enqueuePendingChildLink } from "../page-mention";
import { isPageTreeDragData, PAGE_TREE_DRAG_TYPE, usePageTreeDragDrop } from "./use-page-tree-drag-drop";
// plane web hooks
import type { EPageStoreType } from "@/plane-web/hooks/store";
import { usePage, usePageStore } from "@/plane-web/hooks/store";
// store types
import type { TPageInstance } from "@/store/pages/base-page";

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
  const { pageId, storeType } = props;
  const page = usePage({ pageId, storeType });
  if (!page) return null;
  return <PageTreeRowContent {...props} page={page} />;
});

type ContentProps = Props & { page: TPageInstance };

const PageTreeRowContent = observer(function PageTreeRowContent(props: ContentProps) {
  const { page, pageId, depth, childIdsByParent, storeType } = props;
  const { createPage } = usePageStore(storeType);
  const { pageOperations } = usePageOperations({ page });
  const router = useAppRouter();
  const params = useParams();
  const reparent = usePageTreeDragDrop(storeType);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isDropTarget, setIsDropTarget] = useState(false);

  const {
    name,
    logo_props,
    access,
    archived_at,
    canCurrentUserArchivePage,
    canCurrentUserDeletePage,
    getRedirectionLink,
  } = page;
  const childIds = childIdsByParent[pageId] ?? [];
  const hasChildren = childIds.length > 0;
  const isArchived = !!archived_at;

  useEffect(() => {
    const element = rowRef.current;
    if (!element) return;
    return combine(
      draggable({
        element,
        getInitialData: () => ({ type: PAGE_TREE_DRAG_TYPE, pageId }),
        onDragStart: () => {
          setIsDragging(true);
          setExpanded(false); // collapse during drag so target rows stay reachable
        },
        onDrop: () => setIsDragging(false),
      }),
      dropTargetForElements({
        element,
        canDrop: ({ source }) => {
          if (!isPageTreeDragData(source.data)) return false;
          // Don't let a row accept a drop from itself.
          return source.data.pageId !== pageId;
        },
        getData: () => ({ type: PAGE_TREE_DRAG_TYPE, pageId }),
        onDragEnter: () => setIsDropTarget(true),
        onDragLeave: () => setIsDropTarget(false),
        onDrop: ({ source }) => {
          setIsDropTarget(false);
          if (!isPageTreeDragData(source.data)) return;
          if (source.data.pageId === pageId) return;
          // Make this row the new parent of the dragged page. The hook handles
          // cycle protection + optimistic update + rollback toast.
          void reparent(source.data.pageId, pageId);
          // Auto-expand so the user immediately sees the dropped child.
          setExpanded(true);
        },
      })
    );
  }, [pageId, reparent]);

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
        // Enqueue a page-mention insert so the parent's editor (which mounts after
        // navigation) can drain it and add the live link. Then land the user on the
        // PARENT, not the child — they see the new link in context, click it to dive
        // into the child when they're ready to type a title.
        enqueuePendingChildLink({ parentId: pageId, childId: newPage.id });
        router.push(`/${workspaceSlug}/projects/${projectId}/pages/${pageId}`);
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

  const openArchiveConfirm = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setArchiveConfirmOpen(true);
  };

  const handleArchiveConfirm = async () => {
    if (isArchiving) return;
    setIsArchiving(true);
    try {
      await pageOperations.toggleArchive();
      setArchiveConfirmOpen(false);
    } finally {
      setIsArchiving(false);
    }
  };

  const archiveLabel = isArchived ? "Restore page" : "Archive page";
  const archiveCopy = isArchived
    ? "This page and any sub-pages will be moved back to the active list."
    : "This page and any sub-pages will be moved to the archived tab. You can restore them anytime.";
  const archivePrimaryText = isArchived
    ? { default: "Restore", loading: "Restoring..." }
    : { default: "Archive", loading: "Archiving..." };

  return (
    <>
      <div
        ref={rowRef}
        className={cn("group flex h-8 items-center gap-1 rounded-sm px-1 text-13 hover:bg-layer-transparent-hover", {
          "opacity-50": isDragging,
          "ring-accent-primary bg-layer-transparent-hover ring-2 ring-inset": isDropTarget,
        })}
        style={{ paddingInlineStart: depth * INDENT_PER_LEVEL + 4 }}
      >
        <span
          className="flex size-3 shrink-0 cursor-grab items-center justify-center text-tertiary opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
          aria-hidden
        >
          <GripVertical className="size-3" />
        </span>
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
        {!isArchived && (
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
        )}
        {canCurrentUserArchivePage && (
          <button
            type="button"
            onClick={openArchiveConfirm}
            className="flex size-5 shrink-0 items-center justify-center rounded text-tertiary opacity-0 transition-opacity group-hover:opacity-100 hover:bg-layer-transparent-hover hover:text-primary focus:opacity-100"
            aria-label={archiveLabel}
            title={archiveLabel}
          >
            {isArchived ? (
              <ArchiveRestoreIcon className="size-3.5" />
            ) : (
              <ArchiveIcon className="size-3.5" color="currentColor" />
            )}
          </button>
        )}
        {canCurrentUserDeletePage && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDeleteModalOpen(true);
            }}
            className="flex size-5 shrink-0 items-center justify-center rounded text-tertiary opacity-0 transition-opacity group-hover:opacity-100 hover:bg-layer-transparent-hover hover:text-danger-primary focus:opacity-100"
            aria-label="Delete page"
            title="Delete page"
          >
            <TrashIcon className="size-3.5" color="currentColor" />
          </button>
        )}
        {/* Spacer fills the remaining row width so hover bg covers the whole row. */}
        <div className="grow" />
      </div>
      <AlertModalCore
        isOpen={archiveConfirmOpen}
        handleClose={() => !isArchiving && setArchiveConfirmOpen(false)}
        handleSubmit={handleArchiveConfirm}
        isSubmitting={isArchiving}
        title={archiveLabel}
        content={archiveCopy}
        variant={isArchived ? "primary" : "danger"}
        primaryButtonText={archivePrimaryText}
      />
      <DeletePageModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        page={page}
        storeType={storeType}
      />
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
