use crate::config::Settings;

#[derive(Debug, Clone)]
pub struct DatabaseConfig {
    pub url: String,
    pub max_connections: u32,
    pub min_connections: u32,
}

/// Seed the admin user if it doesn't already exist.
/// Creates entries in both `user` and `account` tables (BetterAuth credential format).
/// Credentials are read from environment variables (via Settings), NOT hardcoded.
pub async fn seed_admin(pool: &sqlx::PgPool, settings: &Settings) -> Result<(), sqlx::Error> {
    let admin_email = &settings.admin.email;
    let admin_password = &settings.admin.password;
    let admin_name = &settings.admin.name;

    let existing: Option<(String,)> = sqlx::query_as("SELECT id FROM \"user\" WHERE email = $1")
        .bind(admin_email)
        .fetch_optional(pool)
        .await?;

    if existing.is_some() {
        tracing::info!("Admin user already exists, skipping seed");
        return Ok(());
    }

    tracing::info!("Seeding admin user ({})...", admin_email);

    let user_id = uuid::Uuid::new_v4().to_string();
    let account_id = uuid::Uuid::new_v4().to_string();

    // Hash password with bcrypt cost 10 (BetterAuth default)
    let password_hash = bcrypt::hash(admin_password, 10)
        .map_err(|e| sqlx::Error::Protocol(format!("bcrypt error: {}", e)))?;

    // Insert user record
    sqlx::query(
        r#"INSERT INTO "user" (id, email, email_verified, name, role, is_active, created_at, updated_at)
           VALUES ($1, $2, true, $3, 'admin', true, NOW(), NOW())"#,
    )
    .bind(&user_id)
    .bind(admin_email)
    .bind(admin_name)
    .execute(pool)
    .await?;

    // Insert account record (BetterAuth credential format)
    sqlx::query(
        r#"INSERT INTO "account" (id, user_id, account_id, provider_id, password, created_at, updated_at)
           VALUES ($1, $2, $3, 'credential', $4, NOW(), NOW())"#,
    )
    .bind(&account_id)
    .bind(&user_id)
    .bind(&user_id)
    .bind(&password_hash)
    .execute(pool)
    .await?;

    tracing::info!("Admin user seeded successfully (email: {})", admin_email);
    Ok(())
}
