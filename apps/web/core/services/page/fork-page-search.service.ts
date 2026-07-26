/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type { TLogoProps } from "@plane/types";
// services
import { APIService } from "@/services/api.service";

// fork: result shape of the /pages/search/ endpoint — a light projection of TPage plus a
// body-match snippet (null when only the title matched).
export type TPageSearchResult = {
  id: string;
  name: string;
  parent: string | null;
  access: number;
  archived_at: string | null;
  logo_props: TLogoProps | null;
  snippet: string | null;
};

export class ForkPageSearchService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async search(workspaceSlug: string, projectId: string, query: string): Promise<TPageSearchResult[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/pages/search/`, {
      params: { query },
    })
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
