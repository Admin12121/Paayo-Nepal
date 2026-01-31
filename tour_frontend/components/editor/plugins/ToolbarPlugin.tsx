'use client';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  FORMAT_TEXT_COMMAND,
  FORMAT_ELEMENT_COMMAND,
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  $getNodeByKey,
} from 'lexical';
import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import {
  $isParentElementRTL,
  $wrapNodes,
  $isAtNodeEnd,
} from '@lexical/selection';
import { $getNearestNodeOfType, mergeRegister } from '@lexical/utils';
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
  $isListNode,
  ListNode,
} from '@lexical/list';
import { createPortal } from 'react-dom';
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
} from '@lexical/rich-text';
import {
  $createCodeNode,
  $isCodeNode,
} from '@lexical/code';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Link,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  Heading1,
  Heading2,
  Heading3,
} from 'lucide-react';

const LowPriority = 1;

const supportedBlockTypes = new Set([
  'paragraph',
  'quote',
  'code',
  'h1',
  'h2',
  'h3',
  'ul',
  'ol',
]);

const blockTypeToBlockName = {
  code: 'Code Block',
  h1: 'Heading 1',
  h2: 'Heading 2',
  h3: 'Heading 3',
  ol: 'Numbered List',
  paragraph: 'Normal',
  quote: 'Quote',
  ul: 'Bulleted List',
};

function Divider() {
  return <div className="w-px h-6 bg-gray-300 mx-1" />;
}

function Select({ onChange, className, options, value }: any) {
  return (
    <select className={className} onChange={onChange} value={value}>
      <option hidden={true} value="" />
      {options.map((option: any) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function getSelectedNode(selection: any) {
  const anchor = selection.anchor;
  const focus = selection.focus;
  const anchorNode = selection.anchor.getNode();
  const focusNode = selection.focus.getNode();
  if (anchorNode === focusNode) {
    return anchorNode;
  }
  const isBackward = selection.isBackward();
  if (isBackward) {
    return $isAtNodeEnd(focus) ? anchorNode : focusNode;
  } else {
    return $isAtNodeEnd(anchor) ? focusNode : anchorNode;
  }
}

export default function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const toolbarRef = useRef(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [blockType, setBlockType] = useState('paragraph');
  const [isLink, setIsLink] = useState(false);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [isCode, setIsCode] = useState(false);

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      const anchorNode = selection.anchor.getNode();
      const element =
        anchorNode.getKey() === 'root'
          ? anchorNode
          : anchorNode.getTopLevelElementOrThrow();
      const elementKey = element.getKey();
      const elementDOM = editor.getElementByKey(elementKey);

      if (elementDOM !== null) {
        if ($isListNode(element)) {
          const parentList = $getNearestNodeOfType(anchorNode, ListNode);
          const type = parentList ? parentList.getTag() : element.getTag();
          setBlockType(type);
        } else {
          const type = $isHeadingNode(element)
            ? element.getTag()
            : element.getType();
          setBlockType(type);
        }
      }

      // Update text format
      setIsBold(selection.hasFormat('bold'));
      setIsItalic(selection.hasFormat('italic'));
      setIsUnderline(selection.hasFormat('underline'));
      setIsStrikethrough(selection.hasFormat('strikethrough'));
      setIsCode(selection.hasFormat('code'));

      // Update links
      const node = getSelectedNode(selection);
      const parent = node.getParent();
      if ($isLinkNode(parent) || $isLinkNode(node)) {
        setIsLink(true);
      } else {
        setIsLink(false);
      }
    }
  }, [editor]);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          updateToolbar();
        });
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        (_payload, newEditor) => {
          updateToolbar();
          return false;
        },
        LowPriority,
      ),
      editor.registerCommand(
        CAN_UNDO_COMMAND,
        (payload) => {
          setCanUndo(payload);
          return false;
        },
        LowPriority,
      ),
      editor.registerCommand(
        CAN_REDO_COMMAND,
        (payload) => {
          setCanRedo(payload);
          return false;
        },
        LowPriority,
      ),
    );
  }, [editor, updateToolbar]);

  const formatParagraph = () => {
    if (blockType !== 'paragraph') {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $wrapNodes(selection, () => $createParagraphNode());
        }
      });
    }
  };

  const formatHeading = (headingSize: 'h1' | 'h2' | 'h3') => {
    if (blockType !== headingSize) {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $wrapNodes(selection, () => $createHeadingNode(headingSize));
        }
      });
    }
  };

  const formatBulletList = () => {
    if (blockType !== 'ul') {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
    } else {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
    }
  };

  const formatNumberedList = () => {
    if (blockType !== 'ol') {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
    } else {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
    }
  };

  const formatQuote = () => {
    if (blockType !== 'quote') {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $wrapNodes(selection, () => $createQuoteNode());
        }
      });
    }
  };

  const formatCode = () => {
    if (blockType !== 'code') {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $wrapNodes(selection, () => $createCodeNode());
        }
      });
    }
  };

  const insertLink = useCallback(() => {
    if (!isLink) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, 'https://');
    } else {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    }
  }, [editor, isLink]);

  return (
    <div
      className="flex items-center gap-1 p-2 border-b border-gray-300 flex-wrap"
      ref={toolbarRef}
    >
      <button
        disabled={!canUndo}
        onClick={() => {
          editor.dispatchCommand(UNDO_COMMAND, undefined);
        }}
        className="p-2 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Undo"
      >
        <Undo className="w-4 h-4" />
      </button>
      <button
        disabled={!canRedo}
        onClick={() => {
          editor.dispatchCommand(REDO_COMMAND, undefined);
        }}
        className="p-2 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Redo"
      >
        <Redo className="w-4 h-4" />
      </button>
      <Divider />
      <button
        onClick={() => formatHeading('h1')}
        className={`p-2 hover:bg-gray-100 rounded ${blockType === 'h1' ? 'bg-gray-200' : ''}`}
        aria-label="Heading 1"
      >
        <Heading1 className="w-4 h-4" />
      </button>
      <button
        onClick={() => formatHeading('h2')}
        className={`p-2 hover:bg-gray-100 rounded ${blockType === 'h2' ? 'bg-gray-200' : ''}`}
        aria-label="Heading 2"
      >
        <Heading2 className="w-4 h-4" />
      </button>
      <button
        onClick={() => formatHeading('h3')}
        className={`p-2 hover:bg-gray-100 rounded ${blockType === 'h3' ? 'bg-gray-200' : ''}`}
        aria-label="Heading 3"
      >
        <Heading3 className="w-4 h-4" />
      </button>
      <Divider />
      <button
        onClick={() => {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold');
        }}
        className={`p-2 hover:bg-gray-100 rounded ${isBold ? 'bg-gray-200' : ''}`}
        aria-label="Format Bold"
      >
        <Bold className="w-4 h-4" />
      </button>
      <button
        onClick={() => {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic');
        }}
        className={`p-2 hover:bg-gray-100 rounded ${isItalic ? 'bg-gray-200' : ''}`}
        aria-label="Format Italics"
      >
        <Italic className="w-4 h-4" />
      </button>
      <button
        onClick={() => {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline');
        }}
        className={`p-2 hover:bg-gray-100 rounded ${isUnderline ? 'bg-gray-200' : ''}`}
        aria-label="Format Underline"
      >
        <Underline className="w-4 h-4" />
      </button>
      <button
        onClick={() => {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough');
        }}
        className={`p-2 hover:bg-gray-100 rounded ${isStrikethrough ? 'bg-gray-200' : ''}`}
        aria-label="Format Strikethrough"
      >
        <Strikethrough className="w-4 h-4" />
      </button>
      <button
        onClick={() => {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code');
        }}
        className={`p-2 hover:bg-gray-100 rounded ${isCode ? 'bg-gray-200' : ''}`}
        aria-label="Insert Code"
      >
        <Code className="w-4 h-4" />
      </button>
      <button
        onClick={insertLink}
        className={`p-2 hover:bg-gray-100 rounded ${isLink ? 'bg-gray-200' : ''}`}
        aria-label="Insert Link"
      >
        <Link className="w-4 h-4" />
      </button>
      <Divider />
      <button
        onClick={formatBulletList}
        className={`p-2 hover:bg-gray-100 rounded ${blockType === 'ul' ? 'bg-gray-200' : ''}`}
        aria-label="Bullet List"
      >
        <List className="w-4 h-4" />
      </button>
      <button
        onClick={formatNumberedList}
        className={`p-2 hover:bg-gray-100 rounded ${blockType === 'ol' ? 'bg-gray-200' : ''}`}
        aria-label="Numbered List"
      >
        <ListOrdered className="w-4 h-4" />
      </button>
      <button
        onClick={formatQuote}
        className={`p-2 hover:bg-gray-100 rounded ${blockType === 'quote' ? 'bg-gray-200' : ''}`}
        aria-label="Quote"
      >
        <Quote className="w-4 h-4" />
      </button>
      <Divider />
      <button
        onClick={() => {
          editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'left');
        }}
        className="p-2 hover:bg-gray-100 rounded"
        aria-label="Left Align"
      >
        <AlignLeft className="w-4 h-4" />
      </button>
      <button
        onClick={() => {
          editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'center');
        }}
        className="p-2 hover:bg-gray-100 rounded"
        aria-label="Center Align"
      >
        <AlignCenter className="w-4 h-4" />
      </button>
      <button
        onClick={() => {
          editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'right');
        }}
        className="p-2 hover:bg-gray-100 rounded"
        aria-label="Right Align"
      >
        <AlignRight className="w-4 h-4" />
      </button>
      <button
        onClick={() => {
          editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'justify');
        }}
        className="p-2 hover:bg-gray-100 rounded"
        aria-label="Justify Align"
      >
        <AlignJustify className="w-4 h-4" />
      </button>
    </div>
  );
}
