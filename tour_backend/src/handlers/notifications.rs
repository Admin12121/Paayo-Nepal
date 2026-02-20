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
    let service = state.notification_service();
    let limit = query.limit.unwrap_or(20).min(50);
    let notifications = service.get_for_user(&user.id, limit).await?;
    Ok(Json(notifications))
}

pub async fn unread_count(
    State(state): State<AppState>,
    user: AuthenticatedUser,
) -> Result<Json<serde_json::Value>, ApiError> {
    let service = state.notification_service();
    let count = service.count_unread(&user.id).await?;
    Ok(Json(serde_json::json!({"count": count})))
}

pub async fn mark_read(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let service = state.notification_service();
    service.mark_read(&id, &user.id).await?;
    Ok(Json(serde_json::json!({"success": true})))
}

pub async fn mark_all_read(
    State(state): State<AppState>,
    user: AuthenticatedUser,
) -> Result<Json<serde_json::Value>, ApiError> {
    let service = state.notification_service();
    service.mark_all_read(&user.id).await?;
    Ok(Json(serde_json::json!({"success": true})))
}

/// SSE stream for real-time notifications.
///
/// Subscribes to two Redis pubsub channels:
/// - `notifications:{user_id}` — new notification events (published by NotificationService::create)
/// - `notifications:{user_id}:count` — unread count updates (published by mark_read / mark_all_read)
///
/// On connection the stream immediately sends the current unread count so the
/// frontend badge is accurate from the very first moment.
///
/// If the Redis pubsub connection cannot be established the handler falls back
/// to a simple database-polling loop (every 10 s) so clients still get updates,
/// just with higher latency.
pub async fn stream(
    State(state): State<AppState>,
    user: AuthenticatedUser,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let user_id = user.id.clone();
    let db = state.db.clone();
    let redis_conn = state.redis.clone();
    let redis_url = state.settings.redis.url.clone();

    let stream = async_stream::stream! {
        // ---- 1. Connected event ----
        yield Ok(Event::default()
            .event("connected")
            .data(format!("{{\"user_id\":\"{}\"}}", user_id))
            .retry(Duration::from_secs(5)));

        // ---- 2. Initial unread count ----
        // Use the full notification service (with Redis) for the initial count
        let service = NotificationService::with_redis(db.clone(), redis_conn.clone());
        if let Ok(count) = service.count_unread(&user_id).await {
            yield Ok(Event::default()
                .event("unread_count")
                .data(format!("{{\"count\":{}}}", count)));
        }

        // ---- 3. Try to open a dedicated pubsub connection ----
        let notification_channel = format!("notifications:{}", user_id);
        let count_channel = format!("notifications:{}:count", user_id);

        let pubsub_result = async {
            let client = redis::Client::open(redis_url.as_str())
                .map_err(|e| format!("redis client open: {}", e))?;
            let mut ps = client
                .get_async_pubsub()
                .await
                .map_err(|e| format!("get_async_pubsub: {}", e))?;
            ps.subscribe(&notification_channel)
                .await
                .map_err(|e| format!("subscribe notifications: {}", e))?;
            ps.subscribe(&count_channel)
                .await
                .map_err(|e| format!("subscribe count: {}", e))?;
            Ok::<_, String>(ps)
        }
        .await;

        match pubsub_result {
            Ok(mut pubsub_conn) => {
                tracing::info!("User {} connected to notification SSE (pubsub)", user_id);

                let mut msg_stream = pubsub_conn.on_message();
                let mut heartbeat = tokio::time::interval(Duration::from_secs(30));
                // consume the first immediate tick
                heartbeat.tick().await;

                loop {
                    tokio::select! {
                        maybe_msg = msg_stream.next() => {
                            match maybe_msg {
                                Some(msg) => {
                                    let channel: String = msg.get_channel_name().to_string();
                                    if let Ok(payload) = msg.get_payload::<String>() {
                                        if channel == count_channel {
                                            // Count-update event (mark_read / mark_all_read)
                                            yield Ok(Event::default()
                                                .event("unread_count")
                                                .data(payload));
                                        } else {
                                            // New notification event
                                            yield Ok(Event::default()
                                                .event("notification")
                                                .data(payload));
                                        }
                                    }
                                }
                                None => {
                                    // Stream ended — Redis disconnected
                                    tracing::warn!("Pubsub stream ended for user {}", user_id);
                                    break;
                                }
                            }
                        }
                        _ = heartbeat.tick() => {
                            yield Ok(Event::default()
                                .event("heartbeat")
                                .data("ping"));
                        }
                    }
                }
            }
            Err(e) => {
                // ---- 4. Fallback: poll the database ----
                tracing::warn!(
                    "Failed to establish Redis pubsub for user {} ({}), falling back to polling",
                    user_id,
                    e,
                );

                let mut interval = tokio::time::interval(Duration::from_secs(10));
                let mut last_count: i64 = -1;

                loop {
                    interval.tick().await;
                    // Read-only polling — NotificationService without Redis is
                    // fine here because we only call count_unread (no publishing).
                    let svc = NotificationService::new(db.clone());
                    if let Ok(count) = svc.count_unread(&user_id).await {
                        // Only send an event when the count actually changes
                        if count != last_count {
                            last_count = count;
                            yield Ok(Event::default()
                                .event("unread_count")
                                .data(format!("{{\"count\":{}}}", count)));
                        }
                    }
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
