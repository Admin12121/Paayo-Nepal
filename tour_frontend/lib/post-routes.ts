export type PostTypeLike = string | null | undefined;

export interface PostRouteInput {
  slug: string;
  post_type?: PostTypeLike;
  type?: PostTypeLike;
}

function normalizePostType(value: PostTypeLike): string {
  return (value || "").toString().trim().toLowerCase();
}

export function getPostPublicPathByType(
  postType: PostTypeLike,
  slug: string,
): string {
  const normalizedType = normalizePostType(postType);
  const safeSlug = (slug || "").trim();

  if (!safeSlug) return "/articles";

  switch (normalizedType) {
    case "explore":
    case "attraction":
      return `/attractions/${safeSlug}`;
    case "event":
      return `/events/${safeSlug}`;
    case "activity":
      return `/activities/${safeSlug}`;
    case "article":
    default:
      return `/blogs/${safeSlug}`;
  }
}

export function getPostPublicPath(post: PostRouteInput): string {
  return getPostPublicPathByType(post.post_type ?? post.type, post.slug);
}

