use axum::{
    extract::{Path, Query, State},
    response::sse::{Event, Sse},
    Json,
};
use futures::stream::Stream;
use serde::Deserialize;
use std::{convert::Infallible, time::Duration};
use tokio_stream::StreamExt;

use crate::{
    error::ApiError, extractors::auth::AuthenticatedUser, models::notification::Notification,
    services::NotificationService, AppState,
};

#[derive(Debug, Deserialize)]
pub struct ListNotificationsQuery {
    pub limit: Option<i32>,
}

pub async fn list(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Query(query): Query<ListNotificationsQuery>,
) -> Result<Json<Vec<Notification>>, ApiError> {
    let service = NotificationService::new(state.db.clone());
    let limit = query.limit.unwrap_or(20).min(50);
    let notifications = service.get_for_user(&user.id, limit).await?;
    Ok(Json(notifications))
}

pub async fn unread_count(
    State(state): State<AppState>,
    user: AuthenticatedUser,
) -> Result<Json<serde_json::Value>, ApiError> {
    let service = NotificationService::new(state.db.clone());
    let count = service.count_unread(&user.id).await?;
    Ok(Json(serde_json::json!({"count": count})))
}

pub async fn mark_read(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let service = NotificationService::new(state.db.clone());
    service.mark_read(&id, &user.id).await?;
    Ok(Json(serde_json::json!({"success": true})))
}

pub async fn mark_all_read(
    State(state): State<AppState>,
    user: AuthenticatedUser,
) -> Result<Json<serde_json::Value>, ApiError> {
    let service = NotificationService::new(state.db.clone());
    service.mark_all_read(&user.id).await?;
    Ok(Json(serde_json::json!({"success": true})))
}

/// SSE stream for real-time notifications
pub async fn stream(
    State(state): State<AppState>,
    user: AuthenticatedUser,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let user_id = user.id.clone();
    let db = state.db.clone();
    let redis = state.redis.clone();

    let stream = async_stream::stream! {
        // Send initial connection event
        yield Ok(Event::default()
            .event("connected")
            .data(format!("{{\"user_id\": \"{}\"}}", user_id)));

        // Subscribe to user-specific channel
        let channel = format!("notifications:{}", user_id);
        
        // Create a pubsub connection
        let mut pubsub_conn = match redis::Client::open(state.settings.redis.url.clone()) {
            Ok(client) => {
                match client.get_async_pubsub().await {
                    Ok(ps) => ps,
                    Err(e) => {
                        tracing::error!("Failed to get pubsub connection: {}", e);
                        // Fall back to polling mode
                        let mut interval = tokio::time::interval(Duration::from_secs(10));
                        loop {
                            interval.tick().await;
                            let service = NotificationService::new(db.clone());
                            if let Ok(count) = service.count_unread(&user_id).await {
                                yield Ok(Event::default()
                                    .event("unread_count")
                                    .data(format!("{{\"count\": {}}}", count)));
                            }
                        }
                    }
                }
            }
            Err(e) => {
                tracing::error!("Failed to open redis client: {}", e);
                return;
            }
        };

        if let Err(e) = pubsub_conn.subscribe(&channel).await {
            tracing::error!("Failed to subscribe to channel {}: {}", channel, e);
            return;
        }

        tracing::info!("User {} subscribed to notifications SSE", user_id);

        let mut message_stream = pubsub_conn.on_message();
        
        // Also send periodic heartbeats
        let mut heartbeat_interval = tokio::time::interval(Duration::from_secs(30));

        loop {
            tokio::select! {
                Some(msg) = message_stream.next() => {
                    if let Ok(payload) = msg.get_payload::<String>() {
                        yield Ok(Event::default()
                            .event("notification")
                            .data(payload));
                    }
                }
                _ = heartbeat_interval.tick() => {
                    yield Ok(Event::default()
                        .event("heartbeat")
                        .data("ping"));
                }
            }
        }
    };

    Sse::new(stream).keep_alive(
        axum::response::sse::KeepAlive::new()
            .interval(Duration::from_secs(15))
            .text("keep-alive"),
    )
}
