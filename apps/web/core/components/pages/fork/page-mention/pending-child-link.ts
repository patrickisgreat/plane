/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

/**
 * Cross-route handoff for the tree-row "+" affordance.
 *
 * The tree-row + button creates a sub-page from the page list, where the parent's editor
 * isn't mounted. To still get a live page-mention link into the parent's body, we enqueue
 * the insertion in sessionStorage and navigate the user to the parent. PageRoot mounts the
 * parent's editor, drains the pending entry, and runs the insertion via the standard
 * insertContentAtPosition path — same flow PR #12 set up for the breadcrumb +.
 *
 * sessionStorage (vs URL params) keeps the URL clean and is naturally one-shot: a tab
 * refresh after the insert ran has already drained the entry.
 */

const STORAGE_KEY = "plane.fork.pendingChildPageMentionLinks";

type PendingEntry = {
  parentId: string;
  childId: string;
};

const isBrowser = (): boolean => typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";

const readAll = (): PendingEntry[] => {
  if (!isBrowser()) return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is PendingEntry =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as PendingEntry).parentId === "string" &&
        typeof (entry as PendingEntry).childId === "string"
    );
  } catch {
    return [];
  }
};

const writeAll = (entries: PendingEntry[]): void => {
  if (!isBrowser()) return;
  try {
    if (entries.length === 0) {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } else {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    }
  } catch {
    // sessionStorage can throw in private mode / quota — silently drop.
  }
};

export const enqueuePendingChildLink = (entry: PendingEntry): void => {
  const all = readAll();
  // Dedupe — if the same insert is already queued we don't want it twice.
  if (all.some((e) => e.parentId === entry.parentId && e.childId === entry.childId)) return;
  writeAll([...all, entry]);
};

/**
 * Atomically removes and returns all pending child-link entries for the given parent.
 */
export const drainPendingChildLinksFor = (parentId: string): PendingEntry[] => {
  const all = readAll();
  const drained = all.filter((e) => e.parentId === parentId);
  if (drained.length === 0) return [];
  const remaining = all.filter((e) => e.parentId !== parentId);
  writeAll(remaining);
  return drained;
};
