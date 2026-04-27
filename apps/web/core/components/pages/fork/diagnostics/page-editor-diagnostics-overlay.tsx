/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState, type RefObject } from "react";
import { ChevronDown, ChevronUp, ClipboardCopy, X } from "lucide-react";
import type { CollaborationState, EditorRefApi, TDocumentInfo } from "@plane/editor";

const POLL_INTERVAL_MS = 1000;

type TPageEditorDiagnosticsOverlayProps = {
  collaborationState: CollaborationState | null;
  editorRef: RefObject<EditorRefApi | null>;
  editorReady: boolean;
  isContentEditable: boolean;
  pageId: string | undefined;
  pageName: string | undefined;
};

type TSnapshot = {
  documentInfo: TDocumentInfo | null;
  binaryBytes: number | null;
};

const formatStage = (state: CollaborationState | null): string => {
  if (!state) return "—";
  const { stage } = state;
  switch (stage.kind) {
    case "reconnecting":
      return `reconnecting (#${stage.attempt})`;
    case "disconnected":
      return `disconnected (${stage.error.type})`;
    default:
      return stage.kind;
  }
};

const formatBytes = (bytes: number | null): string => {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

const formatTimestamp = (ts: number | null): string => {
  if (ts == null) return "—";
  const delta = Date.now() - ts;
  if (delta < 1000) return "just now";
  if (delta < 60_000) return `${Math.floor(delta / 1000)}s ago`;
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  return new Date(ts).toLocaleTimeString();
};

export const PageEditorDiagnosticsOverlay = ({
  collaborationState,
  editorRef,
  editorReady,
  isContentEditable,
  pageId,
  pageName,
}: TPageEditorDiagnosticsOverlayProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [snapshot, setSnapshot] = useState<TSnapshot>({ documentInfo: null, binaryBytes: null });
  const [lastCollabChangeAt, setLastCollabChangeAt] = useState<number | null>(null);
  const [lastDocChangeAt, setLastDocChangeAt] = useState<number | null>(null);
  const lastSnapshotRef = useRef<TSnapshot>({ documentInfo: null, binaryBytes: null });

  // Track when collaboration state transitions occur
  useEffect(() => {
    setLastCollabChangeAt(Date.now());
  }, [collaborationState?.stage.kind]);

  // Poll editor for document info + binary size; cheap and avoids subscribing to internal callbacks.
  useEffect(() => {
    if (dismissed || collapsed) return;

    const tick = () => {
      const editor = editorRef.current;
      if (!editor) return;
      let documentInfo: TDocumentInfo | null = null;
      let binaryBytes: number | null = null;
      try {
        documentInfo = editor.getDocumentInfo();
      } catch {
        documentInfo = null;
      }
      try {
        binaryBytes = editor.getDocument().binary?.byteLength ?? null;
      } catch {
        binaryBytes = null;
      }

      const prev = lastSnapshotRef.current;
      const changed =
        prev.binaryBytes !== binaryBytes ||
        prev.documentInfo?.characters !== documentInfo?.characters ||
        prev.documentInfo?.words !== documentInfo?.words ||
        prev.documentInfo?.paragraphs !== documentInfo?.paragraphs;

      if (changed) {
        lastSnapshotRef.current = { documentInfo, binaryBytes };
        setSnapshot({ documentInfo, binaryBytes });
        setLastDocChangeAt(Date.now());
      }
    };

    tick();
    const id = window.setInterval(tick, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [editorRef, dismissed, collapsed]);

  if (dismissed) return null;

  const stageLabel = formatStage(collaborationState);
  const isHealthy = collaborationState?.isServerSynced && editorReady;
  const dotClass = isHealthy
    ? "bg-green-500"
    : collaborationState?.isServerDisconnected
      ? "bg-red-500"
      : "bg-yellow-400";

  const handleCopy = () => {
    const payload = {
      pageId,
      pageName,
      isContentEditable,
      editorReady,
      collaborationState,
      documentInfo: snapshot.documentInfo,
      binaryBytes: snapshot.binaryBytes,
      lastCollabChangeAt,
      lastDocChangeAt,
      capturedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };
    void navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
  };

  return (
    <div
      className="border-custom-border-200 bg-custom-background-100/95 font-mono shadow-lg fixed right-3 bottom-3 z-40 w-80 max-w-[calc(100vw-1.5rem)] rounded-md border text-[11px] leading-tight backdrop-blur select-text"
      role="complementary"
      aria-label="Editor diagnostics"
    >
      <div className="border-custom-border-200 flex items-center gap-2 border-b px-2 py-1.5">
        <span className={`inline-block size-2 rounded-full ${dotClass}`} aria-hidden />
        <span className="text-custom-text-100 grow font-semibold">Editor diagnostics</span>
        <button
          type="button"
          onClick={handleCopy}
          className="text-custom-text-300 hover:bg-custom-background-90 hover:text-custom-text-100 rounded p-1"
          aria-label="Copy diagnostics to clipboard"
          title="Copy state to clipboard"
        >
          <ClipboardCopy className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="text-custom-text-300 hover:bg-custom-background-90 hover:text-custom-text-100 rounded p-1"
          aria-label={collapsed ? "Expand diagnostics" : "Collapse diagnostics"}
        >
          {collapsed ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-custom-text-300 hover:bg-custom-background-90 hover:text-custom-text-100 rounded p-1"
          aria-label="Close diagnostics"
        >
          <X className="size-3.5" />
        </button>
      </div>
      {!collapsed && (
        <div className="text-custom-text-200 flex flex-col gap-1.5 px-2 py-2">
          <Section title="Page">
            <Row label="id" value={pageId ?? "—"} mono />
            <Row label="name" value={pageName || "(untitled)"} truncate />
            <Row label="editable" value={String(isContentEditable)} />
          </Section>
          <Section title="Connection">
            <Row label="stage" value={stageLabel} />
            <Row label="synced" value={String(collaborationState?.isServerSynced ?? false)} />
            <Row label="disconnected" value={String(collaborationState?.isServerDisconnected ?? false)} />
            <Row label="last change" value={formatTimestamp(lastCollabChangeAt)} />
          </Section>
          <Section title="Editor">
            <Row label="ready" value={String(editorReady)} />
            <Row label="chars" value={snapshot.documentInfo?.characters?.toLocaleString() ?? "—"} />
            <Row label="words" value={snapshot.documentInfo?.words?.toLocaleString() ?? "—"} />
            <Row label="paragraphs" value={snapshot.documentInfo?.paragraphs?.toLocaleString() ?? "—"} />
            <Row label="yjs binary" value={formatBytes(snapshot.binaryBytes)} />
            <Row label="last doc tick" value={formatTimestamp(lastDocChangeAt)} />
          </Section>
        </div>
      )}
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <div className="tracking-wider text-custom-text-400 mb-0.5 text-[10px] uppercase">{title}</div>
    <div className="flex flex-col gap-0.5">{children}</div>
  </div>
);

const Row = ({
  label,
  value,
  mono,
  truncate,
}: {
  label: string;
  value: string;
  mono?: boolean;
  truncate?: boolean;
}) => (
  <div className="flex items-baseline gap-2">
    <span className="text-custom-text-300 w-20 shrink-0">{label}</span>
    <span
      className={`text-custom-text-100 grow text-right ${mono ? "" : ""} ${truncate ? "truncate" : "break-all"}`}
      title={value}
    >
      {value}
    </span>
  </div>
);
