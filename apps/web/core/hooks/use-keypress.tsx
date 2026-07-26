/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef } from "react";

const useKeypress = (key: string, callback: (event: KeyboardEvent) => void) => {
  // Latest-ref pattern: callers routinely pass a fresh inline callback each render;
  // holding it in a ref keeps the document listener stable instead of tearing it
  // down and re-adding it on every render. Synced in an effect (not during render)
  // so a discarded concurrent render can't leak its callback into the committed tree.
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

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
