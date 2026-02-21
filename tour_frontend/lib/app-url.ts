const DEFAULT_DEV_APP_URL = "http://localhost:3000";

function normalizeAbsoluteOrigin(value: string | undefined | null): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

export function resolvePublicAppUrl(): string {
  return (
    normalizeAbsoluteOrigin(process.env.APP_PUBLIC_ORIGIN) ||
    normalizeAbsoluteOrigin(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeAbsoluteOrigin(process.env.BETTER_AUTH_URL) ||
    DEFAULT_DEV_APP_URL
  );
}

export const PUBLIC_APP_URL = resolvePublicAppUrl();
