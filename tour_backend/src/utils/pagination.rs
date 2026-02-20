use serde::Deserialize;

/// Maximum number of items any list endpoint will return per page.
const MAX_LIMIT: i32 = 100;

/// Minimum number of items per page (floor).
const MIN_LIMIT: i32 = 1;

/// Default number of items per page when the caller omits `limit`.
const DEFAULT_LIMIT: i32 = 10;

#[derive(Debug, Clone, Deserialize, Default)]
pub struct PaginationParams {
    pub page: Option<i32>,
    pub limit: Option<i32>,
}

impl PaginationParams {
    /// Compute the SQL `OFFSET` value.
    ///
    /// Uses the **capped** limit (via [`Self::limit`]) so that the offset is
    /// always consistent with the actual page size returned to the caller.
    pub fn offset(&self) -> i32 {
        let page = self.page().max(1);
        let limit = self.limit();
        (page - 1) * limit
    }

    /// Return the page number, defaulting to 1.
    pub fn page(&self) -> i32 {
        self.page.unwrap_or(1).max(1)
    }

    /// Return the per-page limit, clamped to `[1, 100]`.
    ///
    /// - If the caller omits `limit`, defaults to 10.
    /// - If the caller sends a value > 100, it is capped at 100.
    /// - If the caller sends a value < 1, it is floored at 1.
    pub fn limit(&self) -> i32 {
        self.limit
            .unwrap_or(DEFAULT_LIMIT)
            .min(MAX_LIMIT)
            .max(MIN_LIMIT)
    }
}

/// Clamp a raw `limit` value to the `[1, max]` range.
///
/// Convenience function for handlers that extract `limit` from their own
/// query struct rather than going through [`PaginationParams`].
///
/// ```ignore
/// let limit = clamped_limit(query.limit.unwrap_or(20), 100);
/// ```
pub fn clamped_limit(raw: i32, max: i32) -> i32 {
    raw.min(max).max(MIN_LIMIT)
}

pub fn calculate_total_pages(total: i64, limit: i32) -> i32 {
    let limit = limit.max(1); // guard against division by zero
    ((total as f64) / (limit as f64)).ceil() as i32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_values() {
        let p = PaginationParams::default();
        assert_eq!(p.page(), 1);
        assert_eq!(p.limit(), 10);
        assert_eq!(p.offset(), 0);
    }

    #[test]
    fn test_limit_capped_at_100() {
        let p = PaginationParams {
            page: Some(1),
            limit: Some(999_999),
        };
        assert_eq!(p.limit(), 100);
    }

    #[test]
    fn test_limit_floored_at_1() {
        let p = PaginationParams {
            page: Some(1),
            limit: Some(-5),
        };
        assert_eq!(p.limit(), 1);
    }

    #[test]
    fn test_offset_uses_capped_limit() {
        let p = PaginationParams {
            page: Some(2),
            limit: Some(500),
        };
        // limit is capped to 100, so offset for page 2 = (2-1) * 100 = 100
        assert_eq!(p.offset(), 100);
    }

    #[test]
    fn test_offset_page_1() {
        let p = PaginationParams {
            page: Some(1),
            limit: Some(20),
        };
        assert_eq!(p.offset(), 0);
    }

    #[test]
    fn test_page_floored_at_1() {
        let p = PaginationParams {
            page: Some(0),
            limit: Some(10),
        };
        assert_eq!(p.page(), 1);
        assert_eq!(p.offset(), 0);
    }

    #[test]
    fn test_negative_page() {
        let p = PaginationParams {
            page: Some(-3),
            limit: Some(10),
        };
        assert_eq!(p.page(), 1);
        assert_eq!(p.offset(), 0);
    }

    #[test]
    fn test_clamped_limit_helper() {
        assert_eq!(clamped_limit(50, 100), 50);
        assert_eq!(clamped_limit(200, 100), 100);
        assert_eq!(clamped_limit(-1, 100), 1);
        assert_eq!(clamped_limit(30, 50), 30);
        assert_eq!(clamped_limit(80, 50), 50);
    }

    #[test]
    fn test_calculate_total_pages() {
        assert_eq!(calculate_total_pages(0, 10), 0);
        assert_eq!(calculate_total_pages(10, 10), 1);
        assert_eq!(calculate_total_pages(11, 10), 2);
        assert_eq!(calculate_total_pages(100, 10), 10);
        assert_eq!(calculate_total_pages(101, 10), 11);
    }

    #[test]
    fn test_calculate_total_pages_zero_limit() {
        // Guard against division by zero — should treat limit as 1
        assert_eq!(calculate_total_pages(10, 0), 10);
    }
}
