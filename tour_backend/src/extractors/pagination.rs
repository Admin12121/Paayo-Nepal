use serde::Deserialize;

/// Pagination parameters for list endpoints
#[derive(Debug, Clone, Deserialize)]
pub struct Pagination {
    #[serde(default = "default_page")]
    pub page: i32,
    #[serde(default = "default_limit")]
    pub limit: i32,
}

fn default_page() -> i32 {
    1
}

fn default_limit() -> i32 {
    10
}

impl Pagination {
    pub fn offset(&self) -> i32 {
        (self.page - 1) * self.limit
    }

    pub fn validate(&self) -> Result<(), &'static str> {
        if self.page < 1 {
            return Err("Page must be at least 1");
        }
        if self.limit < 1 || self.limit > 100 {
            return Err("Limit must be between 1 and 100");
        }
        Ok(())
    }
}

impl Default for Pagination {
    fn default() -> Self {
        Self {
            page: default_page(),
            limit: default_limit(),
        }
    }
}
