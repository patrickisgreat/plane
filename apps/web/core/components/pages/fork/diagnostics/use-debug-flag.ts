/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

// Reads `?debug=<flag>` (or comma-separated `?debug=editor,foo`) from the URL.
// Dev-only — always returns false in production builds regardless of the flag.
export const useDebugFlag = (flag: string): boolean => {
  const searchParams = useSearchParams();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      setEnabled(false);
      return;
    }
    const raw = searchParams.get("debug");
    if (!raw) {
      setEnabled(false);
      return;
    }
    const flags = raw.split(",").map((s) => s.trim());
    setEnabled(flags.includes(flag));
  }, [searchParams, flag]);

  return enabled;
};
