use sqlx::PgPool;

use crate::error::ApiError;

/// Escape LIKE metacharacters (`%`, `_`, `\`) in user input to prevent
/// pattern manipulation in ILIKE queries. Without this, a search for `%`
/// would match every row, and `_` would act as a single-char wildcard.
fn escape_like(input: &str) -> String {
    input
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}

/// User list item for admin views
#[derive(Debug, Clone, serde::Serialize, sqlx::FromRow)]
pub struct UserListItem {
    pub id: String,
    pub email: String,
    pub email_verified: bool,
    pub name: Option<String>,
    pub image: Option<String>,
    pub role: String,
    pub is_active: bool,
    pub banned_at: Option<chrono::DateTime<chrono::Utc>>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

/// Filters for listing users
#[derive(Debug, Default)]
pub struct ListUsersFilter {
    pub role: Option<String>,
    pub status: Option<String>,
    pub search: Option<String>,
}

/// User counts for admin dashboard
#[derive(Debug, Clone, serde::Serialize)]
pub struct UserCounts {
    pub total: i64,
    pub active: i64,
    pub pending: i64,
    pub blocked: i64,
    pub admins: i64,
    pub editors: i64,
}

pub struct UserService {
    db: PgPool,
}

impl UserService {
    pub fn new(db: PgPool) -> Self {
        Self { db }
    }

    /// List users with pagination and optional filters.
    pub async fn list(
        &self,
        page: i32,
        limit: i32,
        filter: &ListUsersFilter,
    ) -> Result<(Vec<UserListItem>, i64), ApiError> {
        let offset = (page - 1) * limit;

        let mut where_clauses = vec!["1=1".to_string()];
        let mut param_idx: usize = 0;
        let mut bind_values: Vec<String> = Vec::new();

        if let Some(ref role) = filter.role {
            if !role.is_empty() {
                param_idx += 1;
                where_clauses.push(format!("role = ${}", param_idx));
                bind_values.push(role.clone());
            }
        }

        if let Some(ref status) = filter.status {
            match status.as_str() {
                "active" => {
                    where_clauses.push("is_active = true AND banned_at IS NULL".to_string())
                }
                "pending" => {
                    where_clauses.push("is_active = false AND banned_at IS NULL".to_string())
                }
                "blocked" => where_clauses.push("banned_at IS NOT NULL".to_string()),
                _ => {}
            }
        }

        if let Some(ref search) = filter.search {
            if !search.is_empty() {
                param_idx += 1;
                let p1 = param_idx;
                param_idx += 1;
                let p2 = param_idx;
                where_clauses.push(format!("(name ILIKE ${} OR email ILIKE ${})", p1, p2));
                let pattern = format!("%{}%", escape_like(search));
                bind_values.push(pattern.clone());
                bind_values.push(pattern);
            }
        }

        let where_sql = where_clauses.join(" AND ");
        let limit_idx = param_idx + 1;
        let offset_idx = param_idx + 2;

        let count_sql = format!(r#"SELECT COUNT(*) FROM "user" WHERE {}"#, where_sql);
        let list_sql = format!(
            r#"SELECT id, email, email_verified, name, image, role, is_active, banned_at, created_at, updated_at
               FROM "user" WHERE {} ORDER BY created_at DESC LIMIT ${} OFFSET ${}"#,
            where_sql, limit_idx, offset_idx
        );

        // Execute count query
        let mut count_query = sqlx::query_as::<_, (i64,)>(&count_sql);
        for val in &bind_values {
            count_query = count_query.bind(val);
        }
        let (total,) = count_query.fetch_one(&self.db).await?;

        // Execute list query
        let mut list_query = sqlx::query_as::<_, UserListItem>(&list_sql);
        for val in &bind_values {
            list_query = list_query.bind(val);
        }
        list_query = list_query.bind(limit as i64).bind(offset as i64);
        let users = list_query.fetch_all(&self.db).await?;

        Ok((users, total))
    }

    /// Get a single user by ID.
    pub async fn get_by_id(&self, id: &str) -> Result<Option<UserListItem>, ApiError> {
        let user = sqlx::query_as::<_, UserListItem>(
            r#"SELECT id, email, email_verified, name, image, role, is_active, banned_at, created_at, updated_at
               FROM "user" WHERE id = $1"#,
        )
        .bind(id)
        .fetch_optional(&self.db)
        .await?;

        Ok(user)
    }

    /// Get a single user by email.
    pub async fn get_by_email(&self, email: &str) -> Result<Option<UserListItem>, ApiError> {
        let user = sqlx::query_as::<_, UserListItem>(
            r#"SELECT id, email, email_verified, name, image, role, is_active, banned_at, created_at, updated_at
               FROM "user" WHERE email = $1"#,
        )
        .bind(email)
        .fetch_optional(&self.db)
        .await?;

        Ok(user)
    }

    /// Activate a user account (set is_active = true, clear ban).
    pub async fn activate(&self, id: &str) -> Result<bool, ApiError> {
        let result =
            sqlx::query(r#"UPDATE "user" SET is_active = true, banned_at = NULL WHERE id = $1"#)
                .bind(id)
                .execute(&self.db)
                .await?;

        Ok(result.rows_affected() > 0)
    }

    /// Deactivate a user account (set is_active = false).
    /// Returns Err if trying to deactivate an admin.
    ///
    /// Also invalidates all sessions so the deactivation takes effect
    /// immediately — the user cannot continue operating with a stale session.
    pub async fn deactivate(&self, id: &str) -> Result<bool, ApiError> {
        // Guard: prevent deactivating admin users
        if self.is_admin(id).await? {
            return Err(ApiError::Forbidden);
        }

        let result = sqlx::query(r#"UPDATE "user" SET is_active = false WHERE id = $1"#)
            .bind(id)
            .execute(&self.db)
            .await?;

        // Invalidate all sessions to force immediate logout
        self.invalidate_sessions(id).await?;

        Ok(result.rows_affected() > 0)
    }

    /// Block a user: deactivate + set banned_at + delete all sessions.
    /// Admins cannot be blocked.
    pub async fn block(&self, id: &str) -> Result<bool, ApiError> {
        if self.is_admin(id).await? {
            return Err(ApiError::Forbidden);
        }

        let result = sqlx::query(
            r#"UPDATE "user" SET is_active = false, banned_at = NOW() WHERE id = $1 AND role != 'admin'"#,
        )
        .bind(id)
        .execute(&self.db)
        .await?;

        // Invalidate all sessions to force immediate logout
        sqlx::query(r#"DELETE FROM "session" WHERE user_id = $1"#)
            .bind(id)
            .execute(&self.db)
            .await?;

        Ok(result.rows_affected() > 0)
    }

    /// Unblock a user: reactivate + clear banned_at.
    pub async fn unblock(&self, id: &str) -> Result<bool, ApiError> {
        let result =
            sqlx::query(r#"UPDATE "user" SET is_active = true, banned_at = NULL WHERE id = $1"#)
                .bind(id)
                .execute(&self.db)
                .await?;

        Ok(result.rows_affected() > 0)
    }

    /// Change a user's role.
    ///
    /// Also invalidates all sessions so the new role takes effect immediately.
    /// Without this, a demoted user (e.g. admin → editor) would retain the old
    /// role's permissions until their session expired naturally (up to 7 days).
    pub async fn change_role(&self, id: &str, new_role: &str) -> Result<bool, ApiError> {
        // Validate role
        match new_role {
            "admin" | "editor" | "user" => {}
            _ => {
                return Err(ApiError::BadRequest(format!(
                    "Invalid role: {}. Must be admin, editor, or user.",
                    new_role
                )));
            }
        }

        let result = sqlx::query(r#"UPDATE "user" SET role = $1 WHERE id = $2"#)
            .bind(new_role)
            .bind(id)
            .execute(&self.db)
            .await?;

        // Force re-authentication so the new role is picked up immediately
        self.invalidate_sessions(id).await?;

        Ok(result.rows_affected() > 0)
    }

    /// Permanently delete a user. Admins cannot be deleted.
    pub async fn delete(&self, id: &str) -> Result<bool, ApiError> {
        let result = sqlx::query(r#"DELETE FROM "user" WHERE id = $1 AND role != 'admin'"#)
            .bind(id)
            .execute(&self.db)
            .await?;

        Ok(result.rows_affected() > 0)
    }

    /// Get aggregate user counts for the admin dashboard.
    pub async fn get_counts(&self) -> Result<UserCounts, ApiError> {
        let (total,): (i64,) = sqlx::query_as(r#"SELECT COUNT(*) FROM "user""#)
            .fetch_one(&self.db)
            .await?;

        let (active,): (i64,) = sqlx::query_as(
            r#"SELECT COUNT(*) FROM "user" WHERE is_active = true AND banned_at IS NULL"#,
        )
        .fetch_one(&self.db)
        .await?;

        let (pending,): (i64,) = sqlx::query_as(
            r#"SELECT COUNT(*) FROM "user" WHERE is_active = false AND banned_at IS NULL"#,
        )
        .fetch_one(&self.db)
        .await?;

        let (blocked,): (i64,) =
            sqlx::query_as(r#"SELECT COUNT(*) FROM "user" WHERE banned_at IS NOT NULL"#)
                .fetch_one(&self.db)
                .await?;

        let (admins,): (i64,) =
            sqlx::query_as(r#"SELECT COUNT(*) FROM "user" WHERE role = 'admin'"#)
                .fetch_one(&self.db)
                .await?;

        let (editors,): (i64,) =
            sqlx::query_as(r#"SELECT COUNT(*) FROM "user" WHERE role = 'editor'"#)
                .fetch_one(&self.db)
                .await?;

        Ok(UserCounts {
            total,
            active,
            pending,
            blocked,
            admins,
            editors,
        })
    }

    /// Check whether a user has the admin role.
    async fn is_admin(&self, id: &str) -> Result<bool, ApiError> {
        let row: Option<(String,)> = sqlx::query_as(r#"SELECT role FROM "user" WHERE id = $1"#)
            .bind(id)
            .fetch_optional(&self.db)
            .await?;

        Ok(matches!(row, Some((role,)) if role == "admin"))
    }

    /// Delete all sessions for a specific user (force logout).
    pub async fn invalidate_sessions(&self, user_id: &str) -> Result<u64, ApiError> {
        let result = sqlx::query(r#"DELETE FROM "session" WHERE user_id = $1"#)
            .bind(user_id)
            .execute(&self.db)
            .await?;

        Ok(result.rows_affected())
    }

    /// Count users created within the last N days (for admin dashboard).
    pub async fn count_recent(&self, days: i32) -> Result<i64, ApiError> {
        let (count,): (i64,) = sqlx::query_as(
            r#"SELECT COUNT(*) FROM "user" WHERE created_at >= CURRENT_DATE - ($1 || ' days')::INTERVAL"#,
        )
        .bind(days.to_string())
        .fetch_one(&self.db)
        .await?;

        Ok(count)
    }
}
