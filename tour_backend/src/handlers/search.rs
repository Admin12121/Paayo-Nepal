use axum::{
    extract::{Query, State},
    Json,
};
use serde::{Deserialize, Serialize};

use crate::{error::ApiError, services::SearchService, AppState};

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub q: String,
    pub limit: Option<i32>,
    #[serde(rename = "type")]
    pub search_type: Option<String>, // posts, events, attractions, activities, regions, videos, photos, hotels, all
}

#[derive(Debug, Serialize)]
pub struct SearchResponse {
    pub query: String,
    pub total: i64,
    pub results: Vec<crate::services::search_service::SearchResult>,
}

pub async fn global_search(
    State(state): State<AppState>,
    Query(query): Query<SearchQuery>,
) -> Result<Json<SearchResponse>, ApiError> {
    if query.q.trim().is_empty() {
        return Err(ApiError::BadRequest(
            "Search query cannot be empty".to_string(),
        ));
    }

    let service = SearchService::new(state.db.clone(), state.cache.clone());

    let limit = query.limit.unwrap_or(20).min(100).max(1);
    let search_type = query.search_type.as_deref().unwrap_or("all");

    let (results, total) = service.search(&query.q, search_type, limit).await?;

    Ok(Json(SearchResponse {
        query: query.q,
        total,
        results,
    }))
}
