use slug::slugify;
use uuid::Uuid;

/// Generate a URL-friendly slug from a title
/// Adds a short UUID suffix to ensure uniqueness
pub fn generate_slug(title: &str) -> String {
    let base_slug = slugify(title);
    let short_id = &Uuid::new_v4().to_string()[..8];
    format!("{}-{}", base_slug, short_id)
}

/// Generate a slug without UUID suffix (for deterministic slugs)
pub fn generate_simple_slug(title: &str) -> String {
    slugify(title)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_slug() {
        let slug = generate_slug("Hello World!");
        assert!(slug.starts_with("hello-world-"));
        assert_eq!(slug.len(), "hello-world-".len() + 8);
    }

    #[test]
    fn test_generate_simple_slug() {
        let slug = generate_simple_slug("Hello World!");
        assert_eq!(slug, "hello-world");
    }

    #[test]
    fn test_unicode_slug() {
        let slug = generate_simple_slug("नेपाल Tourism");
        // Unicode characters are transliterated or removed
        assert!(!slug.is_empty());
    }
}
