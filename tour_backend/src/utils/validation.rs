use std::collections::HashSet;

use serde_json::Value as JsonValue;

/// Validate that a string is not empty after trimming
pub fn is_not_empty(s: &str) -> bool {
    !s.trim().is_empty()
}

/// Validate email format using the `validator` crate's RFC-compliant check.
///
/// Previous implementation only checked for `@`, `.`, and length ≥ 5, which
/// accepted clearly invalid addresses like `"@."` or `"a@b.c"`.
pub fn is_valid_email(email: &str) -> bool {
    use validator::ValidateEmail;
    email.validate_email()
}

/// Validate slug format (lowercase, alphanumeric, hyphens)
pub fn is_valid_slug(slug: &str) -> bool {
    !slug.is_empty()
        && slug
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
        && !slug.starts_with('-')
        && !slug.ends_with('-')
}

/// Validate URL format
pub fn is_valid_url(url: &str) -> bool {
    url.starts_with("http://") || url.starts_with("https://")
}

/// Sanitize HTML content — strips all tags and returns plain text.
///
/// Uses the `ammonia` crate for robust, spec-compliant HTML sanitization.
/// This is safe against all known XSS bypass techniques (case variations,
/// encoding tricks, nested tags, event handlers, etc.).
///
/// For rich-text content that should preserve safe formatting (bold, links,
/// lists, etc.), use `ammonia::Builder` with an explicit tag allowlist
/// instead of this function.
pub fn sanitize_html(content: &str) -> String {
    ammonia::clean(content)
}

/// Sanitize a `serde_json::Value` that contains rich HTML content from the
/// Tiptap editor.
///
/// The editor sends content as a JSON string (via `editor.getHTML()`), so
/// the `Value` is typically `Value::String("...")`. This function handles
/// all variants:
///
///   - `Value::String(html)` → sanitize and return `Value::String(clean)`
///   - `Value::Null`         → pass through unchanged
///   - `Value::Object` / `Value::Array` → recursively sanitize any string
///     values that look like HTML (contain `<`). This handles legacy Lexical
///     format where content was a JSON object with HTML fragments.
///   - Other primitives (numbers, bools) → pass through unchanged
///
/// This should be called in handlers before passing content to the service
/// layer for storage. It ensures that even if the frontend sanitization is
/// bypassed (e.g. via a direct API call), the stored HTML is safe.
///
/// # Example
///
/// ```ignore
/// let sanitized = sanitize_content_value(input.content.as_ref());
/// service.create(..., sanitized.as_ref(), ...).await?;
/// ```
pub fn sanitize_content_value(content: Option<&JsonValue>) -> Option<JsonValue> {
    match content {
        None => None,
        Some(JsonValue::Null) => Some(JsonValue::Null),
        Some(JsonValue::String(html)) => {
            if html.trim().is_empty() {
                Some(JsonValue::String(String::new()))
            } else {
                Some(JsonValue::String(sanitize_rich_html(html)))
            }
        }
        Some(JsonValue::Object(map)) => {
            // Recursively sanitize string values in objects (legacy format)
            let sanitized: serde_json::Map<String, JsonValue> = map
                .iter()
                .map(|(k, v)| (k.clone(), sanitize_content_value_inner(v)))
                .collect();
            Some(JsonValue::Object(sanitized))
        }
        Some(JsonValue::Array(arr)) => {
            let sanitized: Vec<JsonValue> = arr.iter().map(sanitize_content_value_inner).collect();
            Some(JsonValue::Array(sanitized))
        }
        Some(other) => Some(other.clone()),
    }
}

/// Inner recursive helper for sanitizing nested JSON values.
fn sanitize_content_value_inner(value: &JsonValue) -> JsonValue {
    match value {
        JsonValue::String(s) => {
            // Only sanitize strings that look like they contain HTML
            if s.contains('<') {
                JsonValue::String(sanitize_rich_html(s))
            } else {
                JsonValue::String(s.clone())
            }
        }
        JsonValue::Object(map) => {
            let sanitized: serde_json::Map<String, JsonValue> = map
                .iter()
                .map(|(k, v)| (k.clone(), sanitize_content_value_inner(v)))
                .collect();
            JsonValue::Object(sanitized)
        }
        JsonValue::Array(arr) => {
            let sanitized: Vec<JsonValue> = arr.iter().map(sanitize_content_value_inner).collect();
            JsonValue::Array(sanitized)
        }
        other => other.clone(),
    }
}

/// Sanitize rich HTML content from the Tiptap editor before storage.
///
/// Uses `ammonia::Builder` with an explicit allowlist that mirrors the
/// frontend DOMPurify configuration in `lib/sanitize.ts`. This ensures
/// that even if the frontend sanitization is bypassed (e.g. via a direct
/// API call), the stored HTML is safe.
///
/// Allowed elements cover everything the Tiptap editor can produce:
///   - Text structure: p, br, span, div, section, article
///   - Headings: h1–h6
///   - Inline formatting: strong, b, em, i, u, s, del, mark, sub, sup, small, code
///   - Links: a (with href, target, rel)
///   - Lists: ul, ol, li, label, input (task lists)
///   - Block elements: blockquote, pre, hr, details, summary
///   - Images: img, figure, figcaption, picture, source
///   - Embeds: iframe (src validated to allowed domains), video, audio
///   - Tables: table, thead, tbody, tfoot, tr, th, td, caption, colgroup, col
///
/// Dangerous elements (script, style, object, embed, form, meta, link)
/// are always stripped. Event handler attributes (onclick, onerror, etc.)
/// are stripped by ammonia by default.
pub fn sanitize_rich_html(content: &str) -> String {
    use ammonia::Builder;

    // --- Allowed tags ---
    let tags: HashSet<&str> = [
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
        // Task lists (Tiptap extension)
        "label",
        "input",
        // Blockquote & code blocks
        "blockquote",
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
        // Tables
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
    ]
    .iter()
    .copied()
    .collect();

    // --- Allowed attributes per tag ---
    // ammonia uses HashMap<&str, HashSet<&str>> for tag_attributes
    let mut tag_attributes = std::collections::HashMap::new();

    // Global attributes allowed on all tags (via wildcard)
    let global_attrs: HashSet<&str> = [
        "class",
        "id",
        "title",
        "dir",
        "lang",
        // data-* attributes used by Tiptap for node types
        "data-type",
        "data-checked",
        "data-list-type",
    ]
    .iter()
    .copied()
    .collect();

    // We apply global attrs to every allowed tag
    for &tag in &tags {
        tag_attributes
            .entry(tag)
            .or_insert_with(HashSet::new)
            .extend(&global_attrs);
    }

    // Links
    // Note: `rel` is NOT listed here — ammonia manages it internally via
    // `link_rel()` and panics if both `tag_attributes["a"]["rel"]` and
    // `link_rel` are set simultaneously.
    tag_attributes
        .entry("a")
        .or_insert_with(HashSet::new)
        .extend(["href", "target"].iter());

    // Images
    tag_attributes
        .entry("img")
        .or_insert_with(HashSet::new)
        .extend(
            [
                "src", "alt", "width", "height", "loading", "srcset", "sizes",
            ]
            .iter(),
        );

    // Picture/source
    tag_attributes
        .entry("source")
        .or_insert_with(HashSet::new)
        .extend(["src", "srcset", "sizes", "type"].iter());

    // Media (video, audio)
    for &media_tag in &["video", "audio"] {
        tag_attributes
            .entry(media_tag)
            .or_insert_with(HashSet::new)
            .extend(
                [
                    "src",
                    "controls",
                    "preload",
                    "autoplay",
                    "loop",
                    "muted",
                    "poster",
                    "playsinline",
                    "width",
                    "height",
                ]
                .iter(),
            );
    }

    // Iframe (video embeds — YouTube, Vimeo, etc.)
    tag_attributes
        .entry("iframe")
        .or_insert_with(HashSet::new)
        .extend(
            [
                "src",
                "width",
                "height",
                "allowfullscreen",
                "frameborder",
                "allow",
                "sandbox",
                "referrerpolicy",
                "loading",
            ]
            .iter(),
        );

    // Tables
    for &table_cell in &["th", "td"] {
        tag_attributes
            .entry(table_cell)
            .or_insert_with(HashSet::new)
            .extend(["colspan", "rowspan", "scope"].iter());
    }

    // Task list checkboxes
    tag_attributes
        .entry("input")
        .or_insert_with(HashSet::new)
        .extend(["type", "checked", "disabled"].iter());

    // Details
    tag_attributes
        .entry("details")
        .or_insert_with(HashSet::new)
        .insert("open");

    // Code blocks
    tag_attributes
        .entry("pre")
        .or_insert_with(HashSet::new)
        .extend(["spellcheck", "data-language"].iter());
    tag_attributes
        .entry("code")
        .or_insert_with(HashSet::new)
        .extend(["spellcheck", "data-language"].iter());

    // Colgroup
    tag_attributes
        .entry("col")
        .or_insert_with(HashSet::new)
        .insert("span");
    tag_attributes
        .entry("colgroup")
        .or_insert_with(HashSet::new)
        .insert("span");

    // --- Allowed URL schemes ---
    let url_schemes: HashSet<&str> = ["http", "https", "mailto", "tel", "data", "blob"]
        .iter()
        .copied()
        .collect();

    // --- Build the sanitizer ---
    let mut builder = Builder::new();

    builder
        .tags(tags)
        .tag_attributes(tag_attributes)
        .url_schemes(url_schemes)
        // Allow style attributes for text-align, aspect-ratio, etc.
        // ammonia strips dangerous CSS like `expression()` and `url(javascript:)`.
        .generic_attributes(["style"].iter().copied().collect())
        // Keep content of stripped tags (e.g. if <script>text</script>, keep "text")
        .strip_comments(true)
        // Allow relative URLs (e.g. /uploads/uuid.avif)
        .url_relative(ammonia::UrlRelative::PassThrough)
        // Link rel — enforce noopener for security
        .link_rel(Some("noopener noreferrer"));

    let cleaned = builder.clean(content).to_string();

    // Post-process: validate iframe src domains.
    // ammonia doesn't support per-tag URL domain validation, so we do a
    // targeted pass to strip iframes with disallowed src domains.
    sanitize_iframe_domains(&cleaned)
}

/// Allowed domains for iframe src attributes.
/// Must match the frontend `ALLOWED_IFRAME_DOMAINS` in `lib/sanitize.ts`.
const ALLOWED_IFRAME_DOMAINS: &[&str] = &[
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

/// Remove `<iframe>` elements whose `src` doesn't match an allowed domain.
///
/// This is a targeted post-processing step because ammonia doesn't support
/// per-tag domain validation. We use a simple regex-based approach rather
/// than a full HTML parser, since the input has already been sanitized by
/// ammonia (so we know the HTML is well-formed and safe).
fn sanitize_iframe_domains(html: &str) -> String {
    // Quick exit — no iframes, nothing to do
    if !html.contains("<iframe") {
        return html.to_string();
    }

    // Match <iframe ...> ... </iframe> and <iframe ... />
    // We process each match and keep it only if the src domain is allowed.
    let mut result = String::with_capacity(html.len());
    let mut remaining = html;

    while let Some(start) = remaining.find("<iframe") {
        // Copy everything before this iframe
        result.push_str(&remaining[..start]);

        // Find the end of this iframe element
        let after_start = &remaining[start..];
        let end_pos = if let Some(close) = after_start.find("</iframe>") {
            close + "</iframe>".len()
        } else if let Some(self_close) = after_start.find("/>") {
            self_close + "/>".len()
        } else if let Some(gt) = after_start.find('>') {
            gt + 1
        } else {
            // Malformed — skip the rest
            after_start.len()
        };

        let iframe_html = &after_start[..end_pos];

        // Extract the src attribute value
        if let Some(src) = extract_attribute(iframe_html, "src") {
            if is_allowed_iframe_domain(&src) {
                result.push_str(iframe_html);
            }
            // else: silently drop the iframe
        } else {
            // No src attribute — drop it
        }

        remaining = &after_start[end_pos..];
    }

    // Append any remaining content after the last iframe
    result.push_str(remaining);
    result
}

/// Extract the value of an HTML attribute from a tag string.
fn extract_attribute<'a>(tag: &'a str, attr_name: &str) -> Option<&'a str> {
    // Look for attr_name="value" or attr_name='value'
    let patterns = [format!("{}=\"", attr_name), format!("{}='", attr_name)];

    for pattern in &patterns {
        if let Some(start) = tag.find(pattern.as_str()) {
            let val_start = start + pattern.len();
            let quote = pattern.chars().last().unwrap();
            if let Some(val_end) = tag[val_start..].find(quote) {
                return Some(&tag[val_start..val_start + val_end]);
            }
        }
    }

    None
}

/// Check if a URL's domain is in the allowed list for iframes.
fn is_allowed_iframe_domain(src: &str) -> bool {
    // Parse the URL to extract the hostname
    // Accept both absolute URLs and protocol-relative URLs
    let hostname = if src.starts_with("//") {
        // Protocol-relative URL
        src[2..].split('/').next().unwrap_or("")
    } else if let Some(after_scheme) = src
        .strip_prefix("https://")
        .or_else(|| src.strip_prefix("http://"))
    {
        after_scheme.split('/').next().unwrap_or("")
    } else {
        return false; // Not a valid URL for an iframe
    };

    // Strip port if present
    let hostname = hostname.split(':').next().unwrap_or(hostname);

    ALLOWED_IFRAME_DOMAINS
        .iter()
        .any(|&domain| hostname == domain || hostname.ends_with(&format!(".{}", domain)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_not_empty() {
        assert!(is_not_empty("hello"));
        assert!(!is_not_empty(""));
        assert!(!is_not_empty("   "));
    }

    #[test]
    fn test_is_valid_email() {
        // Valid emails
        assert!(is_valid_email("user@example.com"));
        assert!(is_valid_email("first.last@domain.co"));
        assert!(is_valid_email("name+tag@sub.domain.org"));

        // Invalid emails — the old implementation accepted most of these
        assert!(!is_valid_email(""));
        assert!(!is_valid_email("@."));
        assert!(!is_valid_email("missing-at-sign.com"));
        assert!(!is_valid_email("@no-local-part.com"));
        assert!(!is_valid_email("no-domain@"));
        assert!(!is_valid_email("spaces in@email.com"));

        // Note: `a@b.c` is considered valid by the `validator` crate per RFC 5321.
        // Single-char TLDs are technically allowed, so we don't reject them.
        assert!(is_valid_email("a@b.c"));
    }

    #[test]
    fn test_is_valid_slug() {
        assert!(is_valid_slug("hello-world"));
        assert!(is_valid_slug("hello-world-123"));
        assert!(!is_valid_slug("Hello-World"));
        assert!(!is_valid_slug("-hello"));
        assert!(!is_valid_slug("hello-"));
        assert!(!is_valid_slug(""));
    }

    #[test]
    fn test_is_valid_url() {
        assert!(is_valid_url("https://example.com"));
        assert!(is_valid_url("http://example.com"));
        assert!(!is_valid_url("ftp://example.com"));
        assert!(!is_valid_url("example.com"));
    }

    // --- sanitize_content_value tests ---

    #[test]
    fn test_sanitize_content_value_string() {
        let input = JsonValue::String("<p>Hello</p><script>alert('xss')</script>".to_string());
        let result = sanitize_content_value(Some(&input)).unwrap();
        if let JsonValue::String(s) = result {
            assert!(s.contains("<p>Hello</p>"));
            assert!(!s.contains("<script"));
        } else {
            panic!("Expected String variant");
        }
    }

    #[test]
    fn test_sanitize_content_value_null() {
        let result = sanitize_content_value(Some(&JsonValue::Null));
        assert_eq!(result, Some(JsonValue::Null));
    }

    #[test]
    fn test_sanitize_content_value_none() {
        let result = sanitize_content_value(None);
        assert_eq!(result, None);
    }

    #[test]
    fn test_sanitize_content_value_empty_string() {
        let input = JsonValue::String("".to_string());
        let result = sanitize_content_value(Some(&input)).unwrap();
        assert_eq!(result, JsonValue::String("".to_string()));
    }

    #[test]
    fn test_sanitize_content_value_nested_object() {
        let input = serde_json::json!({
            "html": "<p>Safe</p><script>bad</script>",
            "count": 5
        });
        let result = sanitize_content_value(Some(&input)).unwrap();
        let obj = result.as_object().unwrap();
        let html = obj.get("html").unwrap().as_str().unwrap();
        assert!(html.contains("<p>Safe</p>"));
        assert!(!html.contains("<script"));
        assert_eq!(obj.get("count").unwrap(), &serde_json::json!(5));
    }

    // --- sanitize_rich_html tests ---

    #[test]
    fn test_rich_html_strips_script_tags() {
        let input = r#"<p>Hello</p><script>alert('xss')</script><p>World</p>"#;
        let output = sanitize_rich_html(input);
        assert!(!output.contains("<script"));
        assert!(!output.contains("alert"));
        assert!(output.contains("<p>Hello</p>"));
        assert!(output.contains("<p>World</p>"));
    }

    #[test]
    fn test_rich_html_strips_event_handlers() {
        let input = r#"<img src="/uploads/test.avif" onerror="alert('xss')" />"#;
        let output = sanitize_rich_html(input);
        assert!(!output.contains("onerror"));
        assert!(output.contains("src="));
    }

    #[test]
    fn test_rich_html_preserves_safe_tags() {
        let input = r#"<h2>Title</h2><p><strong>Bold</strong> and <em>italic</em></p><ul><li>Item</li></ul>"#;
        let output = sanitize_rich_html(input);
        assert!(output.contains("<h2>"));
        assert!(output.contains("<strong>"));
        assert!(output.contains("<em>"));
        assert!(output.contains("<ul>"));
        assert!(output.contains("<li>"));
    }

    #[test]
    fn test_rich_html_preserves_images() {
        let input = r#"<img src="/uploads/abc123.avif" alt="Photo" loading="lazy" />"#;
        let output = sanitize_rich_html(input);
        assert!(output.contains("src=\"/uploads/abc123.avif\""));
        assert!(output.contains("alt=\"Photo\""));
        assert!(output.contains("loading=\"lazy\""));
    }

    #[test]
    fn test_rich_html_allows_youtube_iframe() {
        let input = r#"<iframe src="https://www.youtube.com/embed/abc123" width="560" height="315" allowfullscreen></iframe>"#;
        let output = sanitize_rich_html(input);
        assert!(output.contains("<iframe"));
        assert!(output.contains("youtube.com"));
    }

    #[test]
    fn test_rich_html_strips_disallowed_iframe_domain() {
        let input = r#"<iframe src="https://evil.example.com/steal"></iframe>"#;
        let output = sanitize_rich_html(input);
        assert!(!output.contains("<iframe"));
        assert!(!output.contains("evil.example.com"));
    }

    #[test]
    fn test_rich_html_strips_javascript_urls() {
        let input = r#"<a href="javascript:alert('xss')">Click me</a>"#;
        let output = sanitize_rich_html(input);
        assert!(!output.contains("javascript:"));
    }

    #[test]
    fn test_rich_html_preserves_style_attribute() {
        let input = r#"<p style="text-align: center;">Centered</p>"#;
        let output = sanitize_rich_html(input);
        assert!(output.contains("text-align: center"));
    }

    #[test]
    fn test_rich_html_preserves_data_attributes() {
        let input = r#"<div data-type="taskList"><label><input type="checkbox" checked disabled />Task</label></div>"#;
        let output = sanitize_rich_html(input);
        assert!(output.contains("data-type=\"taskList\""));
        assert!(output.contains("type=\"checkbox\""));
    }

    #[test]
    fn test_rich_html_preserves_tables() {
        let input = r#"<table><thead><tr><th>Header</th></tr></thead><tbody><tr><td colspan="2">Cell</td></tr></tbody></table>"#;
        let output = sanitize_rich_html(input);
        assert!(output.contains("<table>"));
        assert!(output.contains("<th>"));
        assert!(output.contains("colspan=\"2\""));
    }

    #[test]
    fn test_rich_html_preserves_code_blocks() {
        let input = r#"<pre data-language="rust"><code>fn main() {}</code></pre>"#;
        let output = sanitize_rich_html(input);
        assert!(output.contains("<pre"));
        assert!(output.contains("data-language=\"rust\""));
        assert!(output.contains("<code>"));
    }

    #[test]
    fn test_rich_html_allows_vimeo_iframe() {
        let input = r#"<iframe src="https://player.vimeo.com/video/123456"></iframe>"#;
        let output = sanitize_rich_html(input);
        assert!(output.contains("<iframe"));
        assert!(output.contains("player.vimeo.com"));
    }

    #[test]
    fn test_rich_html_preserves_details_summary() {
        let input = r#"<details open><summary>Toggle</summary><p>Hidden content</p></details>"#;
        let output = sanitize_rich_html(input);
        assert!(output.contains("<details"));
        assert!(output.contains("<summary>"));
        assert!(output.contains("open"));
    }

    // --- iframe domain validation tests ---

    #[test]
    fn test_iframe_domain_youtube() {
        assert!(is_allowed_iframe_domain(
            "https://www.youtube.com/embed/abc"
        ));
        assert!(is_allowed_iframe_domain(
            "https://www.youtube-nocookie.com/embed/abc"
        ));
    }

    #[test]
    fn test_iframe_domain_vimeo() {
        assert!(is_allowed_iframe_domain(
            "https://player.vimeo.com/video/123"
        ));
    }

    #[test]
    fn test_iframe_domain_disallowed() {
        assert!(!is_allowed_iframe_domain("https://evil.com/payload"));
        assert!(!is_allowed_iframe_domain("https://notyoutube.com/embed"));
        assert!(!is_allowed_iframe_domain("javascript:alert(1)"));
    }
}
