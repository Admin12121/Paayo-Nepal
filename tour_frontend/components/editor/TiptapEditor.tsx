"use client";

import { apiFetch } from "@/lib/csrf";
import { toast } from "@/lib/utils/toast";
import type { PartialBlock } from "@blocknote/core";
import * as BlockNoteMantine from "@blocknote/mantine";
import { MantineProvider } from "@mantine/core";
import {
  BlockNoteViewRaw,
  ComponentsContext,
  useCreateBlockNote,
} from "@blocknote/react";
import "@blocknote/mantine/style.css";
import "@blocknote/core/fonts/inter.css";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef } from "react";

interface TiptapEditorProps {
  initialContent?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
  classicToolbar?: boolean;
  uploadImage?: (file: File) => Promise<string>;
}

async function defaultUploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);

  const response = await apiFetch("/api/media", {
    method: "POST",
    body: fd,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Upload failed");
  }

  const data = (await response.json()) as { url?: string; filename?: string };
  const fileUrl =
    data.url || (data.filename ? `/uploads/${data.filename}` : "");

  if (!fileUrl) throw new Error("Server did not return a file URL");
  return fileUrl;
}

const EMPTY_DOC: PartialBlock[] = [{ type: "paragraph" }];
const SERIALIZE_DEBOUNCE_MS = 300;
const mantineComponents = BlockNoteMantine.components;

export default function TiptapEditor({
  initialContent = "",
  onChange,
  placeholder = "Type '/' for commands, or just start writing...",
  editable = true,
  classicToolbar = false,
  uploadImage = defaultUploadImage,
}: TiptapEditorProps) {
  const { resolvedTheme } = useTheme();
  const serializeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const isApplyingRemoteContentRef = useRef(false);
  const lastSyncedHtmlRef = useRef("");

  const uploadFile = useCallback(
    async (file: File) => {
      return uploadImage(file);
    },
    [uploadImage],
  );

  const editor = useCreateBlockNote(
    {
      uploadFile,
      placeholders: {
        default: placeholder,
        emptyDocument: placeholder,
      },
    },
    [uploadFile, placeholder],
  );

  const applyHtmlContent = useCallback(
    async (html: string) => {
      const trimmed = html.trim();
      const parsedBlocks = trimmed
        ? await editor.tryParseHTMLToBlocks(trimmed)
        : EMPTY_DOC;
      const nextBlocks = parsedBlocks.length > 0 ? parsedBlocks : EMPTY_DOC;

      isApplyingRemoteContentRef.current = true;
      try {
        const existingIds = editor.document.map(
          (block: { id: string }) => block.id,
        );
        editor.replaceBlocks(existingIds, nextBlocks);
      } finally {
        isApplyingRemoteContentRef.current = false;
      }
    },
    [editor],
  );

  useEffect(() => {
    const nextHtml = initialContent || "";
    if (nextHtml === lastSyncedHtmlRef.current) return;

    let cancelled = false;
    const sync = async () => {
      try {
        await applyHtmlContent(nextHtml);
        if (!cancelled) {
          lastSyncedHtmlRef.current = nextHtml;
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load editor content", error);
          toast.error("Failed to load editor content");
        }
      }
    };

    void sync();

    return () => {
      cancelled = true;
    };
  }, [initialContent, applyHtmlContent]);

  useEffect(() => {
    return () => {
      if (serializeTimeoutRef.current) {
        clearTimeout(serializeTimeoutRef.current);
      }
    };
  }, []);

  const emitSerializedHtml = useCallback(async () => {
    if (isApplyingRemoteContentRef.current) return;

    try {
      const html = await editor.blocksToHTMLLossy();
      if (html === lastSyncedHtmlRef.current) return;
      lastSyncedHtmlRef.current = html;
      onChange?.(html);
    } catch (error) {
      console.error("Failed to serialize editor content", error);
    }
  }, [editor, onChange]);

  const handleEditorChange = useCallback(() => {
    if (serializeTimeoutRef.current) {
      clearTimeout(serializeTimeoutRef.current);
    }

    serializeTimeoutRef.current = setTimeout(() => {
      void emitSerializedHtml();
    }, SERIALIZE_DEBOUNCE_MS);
  }, [emitSerializedHtml]);

  if (!mantineComponents) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        Editor UI failed to initialize. Please refresh.
      </div>
    );
  }

  return (
    <MantineProvider withCssVariables={false}>
      <ComponentsContext.Provider value={mantineComponents}>
        <BlockNoteViewRaw
          editor={editor}
          theme={resolvedTheme === "dark" ? "dark" : "light"}
          className="bn-mantine !bg-transparent"
          data-mantine-color-scheme={resolvedTheme === "dark" ? "dark" : "light"}
          editable={editable}
          formattingToolbar={!classicToolbar}
          sideMenu={!classicToolbar}
          slashMenu
          linkToolbar
          filePanel
          tableHandles
          emojiPicker={false}
          comments={false}
          onChange={handleEditorChange}
        />
      </ComponentsContext.Provider>
    </MantineProvider>
  );
}
