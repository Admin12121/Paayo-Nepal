import DOMPurify from "isomorphic-dompurify";

// ---------------------------------------------------------------------------
// HTML Sanitization Utility
//
// Sanitizes HTML output from the Tiptap editor before rendering with
// `dangerouslySetInnerHTML`. Uses DOMPurify under the hood, configured
// to allow the rich content that the editor produces (headings, lists,
// images, embeds, audio/video, bookmarks, code blocks, etc.) while
// stripping any dangerous scripts or event handlers.
//
// Usage:
//   import { sanitizeHtml } from "@/lib/sanitize";
//
//   <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }} />
// ---------------------------------------------------------------------------

// Tags the Tiptap editor can produce
const ALLOWED_TAGS = [
  // Text & structure
  "p",
  "br",
  "span",
  "div",
  "section",
  "article",

  // Headings
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",

  // Inline formatting
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "del",
  "mark",
  "sub",
  "sup",
  "small",
  "code",

  // Links
  "a",

  // Lists
  "ul",
  "ol",
  "li",

  // Task lists (from @tiptap/extension-task-list)
  "label",
  "input",

  // Blockquote
  "blockquote",

  // Code blocks
  "pre",

  // Horizontal rule
  "hr",

  // Images
  "img",
  "figure",
  "figcaption",
  "picture",
  "source",

  // Video embeds (iframe for YouTube/Vimeo, video for direct)
  "iframe",
  "video",

  // Audio
  "audio",

  // Tables (in case editor is extended later)
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "caption",
  "colgroup",
  "col",

  // Details/summary (toggle blocks)
  "details",
  "summary",
];

// Attributes the editor output may contain
const ALLOWED_ATTR = [
  // Global
  "class",
  "id",
  "style",
  "title",
  "dir",
  "lang",

  // Data attributes (used by Tiptap for node types)
  "data-type",
  "data-checked",
  "data-list-type",

  // Links
  "href",
  "target",
  "rel",

  // Images
  "src",
  "alt",
  "width",
  "height",
  "loading",
  "srcset",
  "sizes",

  // Media
  "controls",
  "preload",
  "autoplay",
  "loop",
  "muted",
  "poster",
  "playsinline",

  // Iframe (video embeds)
  "allowfullscreen",
  "frameborder",
  "allow",
  "sandbox",
  "referrerpolicy",

  // Tables
  "colspan",
  "rowspan",
  "scope",

  // Task list checkboxes
  "type",
  "checked",
  "disabled",

  // Details
  "open",

  // Text alignment (Tiptap adds style="text-align: ...")
  "align",

  // Code blocks
  "spellcheck",
  "data-language",
];

// Allowed URI schemes — prevents javascript: URIs etc.
const ALLOWED_URI_REGEXP =
  /^(?:(?:https?|mailto|tel|data|blob):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;

// Domains allowed in iframe src (video embeds)
const ALLOWED_IFRAME_DOMAINS = [
  "www.youtube.com",
  "youtube.com",
  "www.youtube-nocookie.com",
  "player.vimeo.com",
  "vimeo.com",
  "www.dailymotion.com",
  "open.spotify.com",
  "w.soundcloud.com",
  "bandcamp.com",
  "codepen.io",
  "codesandbox.io",
];

/**
 * Sanitize HTML content produced by the Tiptap editor.
 *
 * Strips all script tags, event handlers (onclick, onerror, etc.),
 * and dangerous URI schemes while preserving the rich formatting,
 * images, video embeds, audio players, and interactive elements
 * that the editor produces.
 *
 * @param dirty - The raw HTML string from the editor
 * @returns Sanitized HTML string safe for `dangerouslySetInnerHTML`
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return "";

  const clean = DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP,

    // Allow iframe for video embeds but validate the src domain
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["allowfullscreen", "frameborder", "target"],

    // Allow data: URIs for base64 images the editor may produce
    ALLOW_DATA_ATTR: true,

    // Keep the content structure intact
    KEEP_CONTENT: true,

    // Allow style attributes (needed for text-align, video aspect ratio, etc.)
    // DOMPurify will still strip dangerous CSS like `expression()` and `url(javascript:)`
    FORCE_BODY: false,

    // Hook to validate iframe src domains
    WHOLE_DOCUMENT: false,
  });

  return clean;
}

/**
 * Sanitize and validate iframe sources.
 *
 * This is registered as a DOMPurify hook to ensure only whitelisted
 * domains can be embedded via iframes.
 */
if (typeof DOMPurify.addHook === "function") {
  DOMPurify.addHook("uponSanitizeElement", (node, data) => {
    if (data.tagName === "iframe") {
      const el = node as Element;
      const src = el.getAttribute("src") || "";
      try {
        const url = new URL(src);
        const isAllowed = ALLOWED_IFRAME_DOMAINS.some(
          (domain) =>
            url.hostname === domain || url.hostname.endsWith(`.${domain}`),
        );
        if (!isAllowed) {
          el.remove();
        }
      } catch {
        // Invalid URL — remove the iframe
        el.remove();
      }
    }
  });

  // Strip dangerous CSS properties from style attributes
  DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => {
    if (data.attrName === "style" && data.attrValue) {
      // Remove any CSS expressions, url(javascript:...), behavior, -moz-binding
      let value = data.attrValue;
      value = value.replace(/expression\s*\(/gi, "");
      value = value.replace(/url\s*\(\s*["']?\s*javascript:/gi, "");
      value = value.replace(/behavior\s*:/gi, "");
      value = value.replace(/-moz-binding\s*:/gi, "");
      data.attrValue = value;
    }
  });
}

/**
 * Prepare content for safe rendering.
 *
 * Handles the case where content might be a JSON string (from older
 * Lexical-format data) or an HTML string (from the new Tiptap editor).
 * Always returns sanitized HTML.
 *
 * @param content - Raw content that may be a string or object
 * @returns Sanitized HTML string
 */
export function prepareContent(content: unknown): string {
  if (!content) return "";

  if (typeof content === "string") {
    // If the string looks like it might be JSON (starts with { or [),
    // try to parse it and stringify it for display. Otherwise treat as HTML.
    const trimmed = content.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        // If it's a Lexical state object, just show a fallback message
        if (parsed.root || parsed.editorState) {
          return sanitizeHtml(
            "<p><em>This content was created with a previous editor version and may not display correctly.</em></p>",
          );
        }
        return sanitizeHtml(JSON.stringify(parsed));
      } catch {
        // Not valid JSON — treat as HTML
        return sanitizeHtml(content);
      }
    }

    return sanitizeHtml(content);
  }

  if (typeof content === "object") {
    return sanitizeHtml(JSON.stringify(content));
  }

  return sanitizeHtml(String(content));
}
