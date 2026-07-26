/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef } from "react";

const useKeypress = (key: string, callback: (event: KeyboardEvent) => void) => {
  // Latest-ref pattern: callers routinely pass a fresh inline callback each render;
  // holding it in a ref keeps the document listener stable instead of tearing it
  // down and re-adding it on every render.
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === key) {
        callbackRef.current(event);
      }
    };

    document.addEventListener("keydown", handleKeydown);

    return () => {
      document.removeEventListener("keydown", handleKeydown);
    };
  }, [key]);
};

export default useKeypress;
