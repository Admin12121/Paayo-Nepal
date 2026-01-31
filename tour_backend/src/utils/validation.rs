/// Validate that a string is not empty after trimming
pub fn is_not_empty(s: &str) -> bool {
    !s.trim().is_empty()
}

/// Validate email format
pub fn is_valid_email(email: &str) -> bool {
    // Simple email validation
    email.contains('@') && email.contains('.') && email.len() >= 5
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

/// Sanitize HTML content (basic - remove script tags)
pub fn sanitize_html(content: &str) -> String {
    // Basic sanitization - in production use a proper HTML sanitizer library
    content
        .replace("<script", "&lt;script")
        .replace("</script>", "&lt;/script&gt;")
        .replace("javascript:", "")
        .replace("onerror=", "")
        .replace("onclick=", "")
        .replace("onload=", "")
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
}
