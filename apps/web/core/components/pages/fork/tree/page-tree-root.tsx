/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import type { TPageNavigationTabs } from "@plane/types";
// plane web hooks
import type { EPageStoreType } from "@/plane-web/hooks/store";
// local imports
import { PageTreeRow } from "./page-tree-row";
import { usePageTree } from "./use-page-tree";

type Props = {
  pageType: TPageNavigationTabs;
  storeType: EPageStoreType;
};

export const PageTreeRoot = observer(function PageTreeRoot(props: Props) {
  const { pageType, storeType } = props;
  const { rootIds, childIdsByParent } = usePageTree(storeType, pageType);

  if (!rootIds || rootIds.length === 0) return null;

  return (
    <div className="flex flex-col gap-0.5 py-1">
      {rootIds.map((pageId) => (
        <PageTreeRow key={pageId} pageId={pageId} depth={0} childIdsByParent={childIdsByParent} storeType={storeType} />
      ))}
    </div>
  );
});
