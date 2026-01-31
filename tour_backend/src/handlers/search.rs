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
    pub search_type: Option<String>, // posts, events, attractions, activities, regions, all
}

#[derive(Debug, Serialize)]
pub struct SearchResult {
    pub id: String,
    pub title: String,
    pub slug: String,
    pub excerpt: Option<String>,
    pub featured_image: Option<String>,
    pub result_type: String,
    pub url: String,
}

#[derive(Debug, Serialize)]
pub struct SearchResponse {
    pub query: String,
    pub total: i64,
    pub results: Vec<SearchResult>,
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

    let limit = query.limit.unwrap_or(20);
    let search_type = query.search_type.as_deref().unwrap_or("all");

    let (results, total) = service.search(&query.q, search_type, limit).await?;

    Ok(Json(SearchResponse {
        query: query.q,
        total,
        results,
    }))
}
