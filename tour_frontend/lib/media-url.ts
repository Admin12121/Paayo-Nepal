const UPLOADS_PATH_PREFIX = "/uploads/";
const API_UPLOADS_PATH_PREFIX = "/api/uploads/";

const MEDIA_FIELD_NAMES = new Set([
  "image",
  "image_url",
  "cover_image",
  "cover_image_url",
  "thumbnail",
  "thumbnail_url",
  "custom_image",
  "profile_image",
  "avatar",
]);

function isLikelyMediaField(fieldName: string): boolean {
  const normalized = fieldName.toLowerCase();
  if (MEDIA_FIELD_NAMES.has(normalized)) return true;
  if (normalized.endsWith("_image")) return true;
  if (normalized.endsWith("_image_url")) return true;
  if (normalized.endsWith("_thumbnail")) return true;
  if (normalized.endsWith("_thumbnail_url")) return true;
  return false;
}

function isUploadPathString(value: string): boolean {
  return (
    value.startsWith("uploads/") ||
    value.startsWith(UPLOADS_PATH_PREFIX) ||
    value.startsWith(API_UPLOADS_PATH_PREFIX) ||
    value.includes(`${UPLOADS_PATH_PREFIX}`)
  );
}

export function normalizeMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const value = url.trim();
  if (!value) return null;

  if (value.startsWith("data:") || value.startsWith("blob:")) return value;

  if (value.startsWith(API_UPLOADS_PATH_PREFIX)) {
    return value.replace(/^\/api/, "");
  }

  if (value.startsWith("uploads/")) {
    return `/${value}`;
  }

  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      if (parsed.pathname.startsWith(API_UPLOADS_PATH_PREFIX)) {
        const pathname = parsed.pathname.replace(/^\/api/, "");
        return `${pathname}${parsed.search}${parsed.hash}`;
      }
      if (parsed.pathname.startsWith(UPLOADS_PATH_PREFIX)) {
        return `${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
      return value;
    } catch {
      return value;
    }
  }

  return value;
}

export function normalizeMediaUrlsDeep<T>(input: T): T {
  const visit = (value: unknown, keyName?: string): unknown => {
    if (typeof value === "string") {
      if (
        (keyName && isLikelyMediaField(keyName)) ||
        isUploadPathString(value)
      ) {
        return normalizeMediaUrl(value) ?? value;
      }
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => visit(item, keyName));
    }

    if (value && typeof value === "object") {
      const output: Record<string, unknown> = {};
      for (const [key, nestedValue] of Object.entries(
        value as Record<string, unknown>,
      )) {
        output[key] = visit(nestedValue, key);
      }
      return output;
    }

    return value;
  };

  return visit(input) as T;
}
