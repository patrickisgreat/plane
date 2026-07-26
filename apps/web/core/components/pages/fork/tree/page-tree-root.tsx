/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import type { TPageNavigationTabs } from "@plane/types";
import { cn } from "@plane/utils";
// plane web hooks
import type { EPageStoreType } from "@/hooks/store";
// local imports
import { PageTreeRow } from "./page-tree-row";
import { usePageTree } from "./use-page-tree";
import { isPageTreeDragData, PAGE_TREE_DRAG_TYPE, usePageTreeDragDrop } from "./use-page-tree-drag-drop";

type Props = {
  pageType: TPageNavigationTabs;
  storeType: EPageStoreType;
};

export const PageTreeRoot = observer(function PageTreeRoot(props: Props) {
  const { pageType, storeType } = props;
  const { rootIds, childIdsByParent } = usePageTree(storeType, pageType);
  const reparent = usePageTreeDragDrop(storeType);
  const rootZoneRef = useRef<HTMLDivElement | null>(null);
  const [isRootDropTarget, setIsRootDropTarget] = useState(false);

  useEffect(() => {
    const element = rootZoneRef.current;
    if (!element) return;
    return dropTargetForElements({
      element,
      canDrop: ({ source }) => isPageTreeDragData(source.data),
      getData: () => ({ type: PAGE_TREE_DRAG_TYPE, pageId: null }),
      onDragEnter: () => setIsRootDropTarget(true),
      onDragLeave: () => setIsRootDropTarget(false),
      onDrop: ({ source }) => {
        setIsRootDropTarget(false);
        if (!isPageTreeDragData(source.data)) return;
        // Promote the dragged page to the project root.
        void reparent(source.data.pageId, null);
      },
    });
  }, [reparent]);

  if (!rootIds || rootIds.length === 0) return null;

  return (
    <div className="flex flex-col gap-0.5 py-1">
      {rootIds.map((pageId) => (
        <PageTreeRow key={pageId} pageId={pageId} depth={0} childIdsByParent={childIdsByParent} storeType={storeType} />
      ))}
      {/* Root-level drop zone — drag a row here to promote it out of its parent. The
          target shows a dashed outline only while dragging so it doesn't sit visible at
          rest. */}
      <div
        ref={rootZoneRef}
        className={cn("mt-1 h-8 rounded-sm border border-dashed border-transparent text-12 text-tertiary", {
          "border-accent-primary bg-layer-transparent-hover": isRootDropTarget,
        })}
        aria-hidden
      >
        {isRootDropTarget && (
          <div className="flex h-full items-center px-3 text-accent-primary">Drop here to move to root</div>
        )}
      </div>
    </div>
  );
});
