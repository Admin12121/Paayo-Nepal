// ---------------------------------------------------------------------------
// Store — Barrel Export
//
// Central re-export point for the Redux store, typed hooks, provider, and
// all RTK Query API slices. Import from `@/lib/store` instead of reaching
// into individual files.
//
// Usage:
//   import { StoreProvider } from "@/lib/store";
//   import { useAppDispatch, useAppSelector } from "@/lib/store";
//   import { useListPostsQuery, useDeletePostMutation } from "@/lib/store";
//   import { baseApi } from "@/lib/store";
// ---------------------------------------------------------------------------

// ── Store & Provider ─────────────────────────────────────────────────────
export { makeStore } from "./store";
export type { AppStore, RootState, AppDispatch } from "./store";
export { StoreProvider } from "./provider";

// ── Typed Hooks ──────────────────────────────────────────────────────────
export { useAppDispatch, useAppSelector, useAppStore } from "./hooks";

// ── Base API (for manual cache invalidation, etc.) ───────────────────────
export { baseApi, buildQueryString, provideListTags } from "./api/baseApi";

// ── Posts API ────────────────────────────────────────────────────────────
export {
  useListPostsQuery,
  useGetPostBySlugQuery,
  useCreatePostMutation,
  useUpdatePostMutation,
  useDeletePostMutation,
  usePublishPostMutation,
  useApprovePostMutation,
  useUpdatePostFeaturedMutation,
  useUpdatePostDisplayOrderMutation,
} from "./api/postsApi";
export { enrichPost, enrichPaginated } from "./api/postsApi";
export type { ListPostsParams } from "./api/postsApi";

// ── Media API ────────────────────────────────────────────────────────────
export {
  useListMediaQuery,
  useListGalleryQuery,
  useGetMediaQuery,
  useUploadMediaMutation,
  useUpdateMediaMutation,
  useDeleteMediaMutation,
  useBatchDeleteMediaMutation,
} from "./api/mediaApi";
export type { ListMediaParams, GalleryParams } from "./api/mediaApi";

// ── Events API ───────────────────────────────────────────────────────────
export {
  useListEventsQuery,
  useListUpcomingEventsQuery,
  useGetEventBySlugQuery,
} from "./api/eventsApi";
export type { ListEventsParams, UpcomingEventsParams } from "./api/eventsApi";

// ── Attractions API ──────────────────────────────────────────────────────
export {
  useListAttractionsQuery,
  useListTopAttractionsQuery,
  useGetAttractionBySlugQuery,
  useDeleteAttractionMutation,
  useCreateAttractionMutation,
  useUpdateAttractionMutation,
} from "./api/attractionsApi";
export type {
  ListAttractionsParams,
  TopAttractionsParams,
} from "./api/attractionsApi";

// ── Activities API ───────────────────────────────────────────────────────
export {
  useListActivitiesQuery,
  useGetActivityBySlugQuery,
  useCreateActivityMutation,
  useUpdateActivityMutation,
  useDeleteActivityMutation,
} from "./api/activitiesApi";
export type { ListActivitiesParams } from "./api/activitiesApi";

// ── Regions API ──────────────────────────────────────────────────────────
export {
  useListRegionsQuery,
  useGetRegionBySlugQuery,
  useGetRegionAttractionsQuery,
  useCreateRegionMutation,
  useUpdateRegionMutation,
  useDeleteRegionMutation,
} from "./api/regionsApi";
export type {
  ListRegionsParams,
  RegionAttractionsParams,
} from "./api/regionsApi";

// ── Hotels API ───────────────────────────────────────────────────────────
export {
  useListHotelsQuery,
  useGetHotelBySlugQuery,
  useGetHotelByIdQuery,
  useGetHotelBranchesQuery,
  useCreateHotelMutation,
  useUpdateHotelMutation,
  useDeleteHotelMutation,
  usePublishHotelMutation,
  useUpdateHotelDisplayOrderMutation,
  useRestoreHotelMutation,
  useAddHotelBranchMutation,
  useUpdateHotelBranchMutation,
  useRemoveHotelBranchMutation,
} from "./api/hotelsApi";
export type { ListHotelsParams } from "./api/hotelsApi";

// ── Videos API ───────────────────────────────────────────────────────────
export {
  useListVideosQuery,
  useGetVideoBySlugQuery,
  useGetVideoByIdQuery,
  useCreateVideoMutation,
  useUpdateVideoMutation,
  useDeleteVideoMutation,
  usePublishVideoMutation,
  useUpdateVideoDisplayOrderMutation,
  useRestoreVideoMutation,
} from "./api/videosApi";
export type { ListVideosParams } from "./api/videosApi";

// ── Photos API ───────────────────────────────────────────────────────────
export {
  useListPhotosQuery,
  useGetPhotoBySlugQuery,
  useGetPhotoByIdQuery,
  useListPhotoImagesQuery,
  useCreatePhotoMutation,
  useUpdatePhotoMutation,
  useDeletePhotoMutation,
  usePublishPhotoMutation,
  useUpdatePhotoDisplayOrderMutation,
  useRestorePhotoMutation,
  useAddPhotoImageMutation,
  useUpdatePhotoImageMutation,
  useRemovePhotoImageMutation,
  useReorderPhotoImagesMutation,
} from "./api/photosApi";
export type { ListPhotosParams } from "./api/photosApi";

// ── Hero Slides API ──────────────────────────────────────────────────────
export {
  useListHeroSlidesQuery,
  useListAllHeroSlidesQuery,
  useGetHeroSlideCountsQuery,
  useGetHeroSlideByIdQuery,
  useCreateHeroSlideMutation,
  useUpdateHeroSlideMutation,
  useDeleteHeroSlideMutation,
  useToggleHeroSlideActiveMutation,
  useReorderHeroSlidesMutation,
} from "./api/heroSlidesApi";

// ── Tags API ─────────────────────────────────────────────────────────────
export {
  useListTagsQuery,
  useSearchTagsQuery,
  useGetTagBySlugQuery,
  useGetTagByIdQuery,
  useGetTagCountQuery,
  useCreateTagMutation,
  useUpdateTagMutation,
  useDeleteTagMutation,
} from "./api/tagsApi";
export type { ListTagsParams } from "./api/tagsApi";

// ── Comments API ─────────────────────────────────────────────────────────
export {
  useListCommentsForPostQuery,
  useListCommentsForContentQuery,
  useListCommentsForModerationQuery,
  useGetPendingCommentCountQuery,
  useCreateCommentMutation,
  useUpdateCommentMutation,
  useDeleteCommentMutation,
  useApproveCommentMutation,
  useRejectCommentMutation,
  useMarkCommentSpamMutation,
  useBatchApproveCommentsMutation,
  useBatchDeleteCommentsMutation,
} from "./api/commentsApi";
export type {
  ListCommentsForPostParams,
  ListCommentsForContentParams,
  ListCommentsForModerationParams,
  CreateCommentInput,
} from "./api/commentsApi";

// ── Engagement API (Views & Likes) ───────────────────────────────────────
export {
  useRecordViewMutation,
  useGetViewStatsQuery,
  useToggleLikeMutation,
  useGetLikeStatusQuery,
} from "./api/engagementApi";
export type {
  RecordViewParams,
  ViewStatsParams,
  LikeParams,
} from "./api/engagementApi";

// ── Notifications API ────────────────────────────────────────────────────
export {
  useListNotificationsQuery,
  useGetUnreadNotificationCountQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} from "./api/notificationsApi";
export type { ListNotificationsParams } from "./api/notificationsApi";

// ── Search API ───────────────────────────────────────────────────────────
export { useSearchQuery, useLazySearchQuery } from "./api/searchApi";
export type { SearchParams } from "./api/searchApi";

// ── Content Links API ─────────────────────────────────────────────────────
export {
  useListContentLinksForSourceQuery,
  useListContentLinksForTargetQuery,
  useCountContentLinksForSourceQuery,
  useCreateContentLinkMutation,
  useUpdateContentLinkMutation,
  useDeleteContentLinkMutation,
  useSetContentLinksForSourceMutation,
  useClearContentLinksForSourceMutation,
} from "./api/contentLinksApi";

// ── Admin Stats API ──────────────────────────────────────────────────────
export {
  useGetDashboardStatsQuery,
  useGetViewsSummaryQuery,
  useGetUserCountsQuery,
} from "./api/adminStatsApi";
