import { baseApi } from "./baseApi";
import type {
  ContentLink,
  CreateContentLinkInput,
  SetContentLinkItemInput,
  ContentLinkSourceType,
  ContentLinkTargetType,
} from "@/lib/api-client";

export const contentLinksApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listContentLinksForSource: builder.query<
      ContentLink[],
      { source_type: ContentLinkSourceType; source_id: string }
    >({
      query: ({ source_type, source_id }) =>
        `/content-links/${source_type}/${source_id}`,
      providesTags: (_result, _error, { source_type, source_id }) => [
        { type: "ContentLink", id: `SOURCE-${source_type}-${source_id}` },
      ],
      keepUnusedDataFor: 120,
    }),

    listContentLinksForTarget: builder.query<
      ContentLink[],
      { target_type: ContentLinkTargetType; target_id: string }
    >({
      query: ({ target_type, target_id }) =>
        `/content-links/target/${target_type}/${target_id}`,
      providesTags: (_result, _error, { target_type, target_id }) => [
        { type: "ContentLink", id: `TARGET-${target_type}-${target_id}` },
      ],
      keepUnusedDataFor: 120,
    }),

    countContentLinksForSource: builder.query<
      { count: number },
      { source_type: ContentLinkSourceType; source_id: string }
    >({
      query: ({ source_type, source_id }) =>
        `/content-links/${source_type}/${source_id}/count`,
      providesTags: (_result, _error, { source_type, source_id }) => [
        { type: "ContentLink", id: `SOURCE-${source_type}-${source_id}` },
      ],
      keepUnusedDataFor: 60,
    }),

    createContentLink: builder.mutation<ContentLink, CreateContentLinkInput>({
      query: (data) => ({
        url: "/content-links",
        method: "POST",
        body: data,
      }),
      invalidatesTags: (_result, _error, args) => [
        {
          type: "ContentLink",
          id: `SOURCE-${args.source_type}-${args.source_id}`,
        },
        {
          type: "ContentLink",
          id: `TARGET-${args.target_type}-${args.target_id}`,
        },
      ],
    }),

    updateContentLink: builder.mutation<
      ContentLink,
      { id: string; display_order?: number }
    >({
      query: ({ id, display_order }) => ({
        url: `/content-links/by-id/${id}`,
        method: "PUT",
        body: { display_order },
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "ContentLink", id },
      ],
    }),

    deleteContentLink: builder.mutation<void, string>({
      query: (id) => ({
        url: `/content-links/by-id/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "ContentLink", id },
      ],
    }),

    setContentLinksForSource: builder.mutation<
      ContentLink[],
      {
        source_type: ContentLinkSourceType;
        source_id: string;
        links: SetContentLinkItemInput[];
      }
    >({
      query: ({ source_type, source_id, links }) => ({
        url: `/content-links/${source_type}/${source_id}`,
        method: "PUT",
        body: { links },
      }),
      invalidatesTags: (_result, _error, { source_type, source_id, links }) => [
        { type: "ContentLink", id: `SOURCE-${source_type}-${source_id}` },
        ...links.map((link) => ({
          type: "ContentLink" as const,
          id: `TARGET-${link.target_type}-${link.target_id}`,
        })),
      ],
    }),

    clearContentLinksForSource: builder.mutation<
      { deleted: number },
      { source_type: ContentLinkSourceType; source_id: string }
    >({
      query: ({ source_type, source_id }) => ({
        url: `/content-links/${source_type}/${source_id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { source_type, source_id }) => [
        { type: "ContentLink", id: `SOURCE-${source_type}-${source_id}` },
      ],
    }),
  }),

  overrideExisting: false,
});

export const {
  useListContentLinksForSourceQuery,
  useListContentLinksForTargetQuery,
  useCountContentLinksForSourceQuery,
  useCreateContentLinkMutation,
  useUpdateContentLinkMutation,
  useDeleteContentLinkMutation,
  useSetContentLinksForSourceMutation,
  useClearContentLinksForSourceMutation,
} = contentLinksApi;
