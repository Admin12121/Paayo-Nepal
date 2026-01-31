"use client";

import { useEffect, useState } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { TabIndentationPlugin } from "@lexical/react/LexicalTabIndentationPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { $generateHtmlFromNodes } from "@lexical/html";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import LexicalErrorBoundary from "@lexical/react/LexicalErrorBoundary";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListNode, ListItemNode } from "@lexical/list";
import { CodeNode, CodeHighlightNode } from "@lexical/code";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { $getRoot, EditorState, type LexicalEditor as LexicalEditorType } from "lexical";
import { TRANSFORMERS } from "@lexical/markdown";

import ToolbarPlugin from "./plugins/ToolbarPlugin";
import AutoLinkPlugin from "./plugins/AutoLinkPlugin";
import CodeHighlightPlugin from "./plugins/CodeHighlightPlugin";
import ImagesPlugin from "./plugins/ImagesPlugin";

const theme = {
  paragraph: "mb-2 text-base leading-relaxed",
  heading: {
    h1: "text-4xl font-bold mb-4 mt-6",
    h2: "text-3xl font-bold mb-3 mt-5",
    h3: "text-2xl font-bold mb-2 mt-4",
    h4: "text-xl font-semibold mb-2 mt-3",
    h5: "text-lg font-semibold mb-1 mt-2",
  },
  list: {
    nested: {
      listitem: "list-none",
    },
    ol: "list-decimal ml-6 mb-2",
    ul: "list-disc ml-6 mb-2",
    listitem: "mb-1",
  },
  link: "text-blue-600 hover:text-blue-800 underline",
  text: {
    bold: "font-bold",
    italic: "italic",
    underline: "underline",
    strikethrough: "line-through",
    code: "bg-gray-100 px-1 py-0.5 rounded font-mono text-sm",
  },
  code: "bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm block my-4 overflow-x-auto",
  quote: "border-l-4 border-gray-300 pl-4 italic my-4 text-gray-700",
};

function onError(error: Error) {
  console.error(error);
}

interface LexicalEditorProps {
  initialContent?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
}

function Placeholder({ text }: { text: string }) {
  return (
    <div className="pointer-events-none absolute left-4 top-4 text-gray-400">
      {text}
    </div>
  );
}

export default function LexicalEditor({
  initialContent,
  onChange,
  placeholder = "Start writing your article...",
  editable = true,
}: LexicalEditorProps) {
  const initialConfig = {
    namespace: "TourismEditor",
    theme,
    onError,
    editable,
    nodes: [
      HeadingNode,
      ListNode,
      ListItemNode,
      QuoteNode,
      CodeNode,
      CodeHighlightNode,
      AutoLinkNode,
      LinkNode,
    ],
  };

  const handleChange = (editorState: EditorState, editor: LexicalEditorType) => {
    editorState.read(() => {
      const htmlString = $generateHtmlFromNodes(editor, null);
      onChange?.(htmlString);
    });
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="relative rounded-lg border border-gray-300 bg-white">
        {editable && <ToolbarPlugin />}
        <div className="relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className="min-h-[400px] resize-none px-4 py-4 outline-none prose max-w-none"
                aria-placeholder={placeholder}
              />
            }
            placeholder={<Placeholder text={placeholder} />}
            ErrorBoundary={LexicalErrorBoundary}
          />
          <OnChangePlugin onChange={handleChange} />
          <HistoryPlugin />
          {editable && <AutoFocusPlugin />}
          <LinkPlugin />
          <ListPlugin />
          <AutoLinkPlugin />
          <CodeHighlightPlugin />
          <ImagesPlugin />
          <TabIndentationPlugin />
          <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
        </div>
      </div>
    </LexicalComposer>
  );
}
