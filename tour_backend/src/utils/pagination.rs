use serde::Deserialize;

#[derive(Debug, Clone, Deserialize, Default)]
pub struct PaginationParams {
    pub page: Option<i32>,
    pub limit: Option<i32>,
}

impl PaginationParams {
    pub fn offset(&self) -> i32 {
        let page = self.page.unwrap_or(1);
        let limit = self.limit.unwrap_or(10);
        (page - 1) * limit
    }

    pub fn page(&self) -> i32 {
        self.page.unwrap_or(1)
    }

    pub fn limit(&self) -> i32 {
        self.limit.unwrap_or(10).min(100).max(1)
    }
}

pub fn calculate_total_pages(total: i64, limit: i32) -> i32 {
    ((total as f64) / (limit as f64)).ceil() as i32
}
