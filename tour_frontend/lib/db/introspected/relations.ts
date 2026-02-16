import { relations } from "drizzle-orm/relations";
import { user, session, account, twoFactor, passkey, posts, regions, photoFeatures, photoImages, videos, hotels, hotelBranches, tags, contentTags, notifications, media } from "./schema";

export const sessionRelations = relations(session, ({one}) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	}),
}));

export const userRelations = relations(user, ({many}) => ({
	sessions: many(session),
	accounts: many(account),
	twoFactors: many(twoFactor),
	passkeys: many(passkey),
	posts: many(posts),
	regions: many(regions),
	photoFeatures: many(photoFeatures),
	videos: many(videos),
	hotels: many(hotels),
	notifications_recipientId: many(notifications, {
		relationName: "notifications_recipientId_user_id"
	}),
	notifications_actorId: many(notifications, {
		relationName: "notifications_actorId_user_id"
	}),
	media: many(media),
}));

export const accountRelations = relations(account, ({one}) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id]
	}),
}));

export const twoFactorRelations = relations(twoFactor, ({one}) => ({
	user: one(user, {
		fields: [twoFactor.userId],
		references: [user.id]
	}),
}));

export const passkeyRelations = relations(passkey, ({one}) => ({
	user: one(user, {
		fields: [passkey.userId],
		references: [user.id]
	}),
}));

export const postsRelations = relations(posts, ({one}) => ({
	user: one(user, {
		fields: [posts.authorId],
		references: [user.id]
	}),
	region: one(regions, {
		fields: [posts.regionId],
		references: [regions.id]
	}),
}));

export const regionsRelations = relations(regions, ({one, many}) => ({
	posts: many(posts),
	user: one(user, {
		fields: [regions.authorId],
		references: [user.id]
	}),
	photoFeatures: many(photoFeatures),
	videos: many(videos),
	hotels: many(hotels),
}));

export const photoFeaturesRelations = relations(photoFeatures, ({one, many}) => ({
	user: one(user, {
		fields: [photoFeatures.authorId],
		references: [user.id]
	}),
	region: one(regions, {
		fields: [photoFeatures.regionId],
		references: [regions.id]
	}),
	photoImages: many(photoImages),
}));

export const photoImagesRelations = relations(photoImages, ({one}) => ({
	photoFeature: one(photoFeatures, {
		fields: [photoImages.photoFeatureId],
		references: [photoFeatures.id]
	}),
}));

export const videosRelations = relations(videos, ({one}) => ({
	user: one(user, {
		fields: [videos.authorId],
		references: [user.id]
	}),
	region: one(regions, {
		fields: [videos.regionId],
		references: [regions.id]
	}),
}));

export const hotelsRelations = relations(hotels, ({one, many}) => ({
	user: one(user, {
		fields: [hotels.authorId],
		references: [user.id]
	}),
	region: one(regions, {
		fields: [hotels.regionId],
		references: [regions.id]
	}),
	hotelBranches: many(hotelBranches),
}));

export const hotelBranchesRelations = relations(hotelBranches, ({one}) => ({
	hotel: one(hotels, {
		fields: [hotelBranches.hotelId],
		references: [hotels.id]
	}),
}));

export const contentTagsRelations = relations(contentTags, ({one}) => ({
	tag: one(tags, {
		fields: [contentTags.tagId],
		references: [tags.id]
	}),
}));

export const tagsRelations = relations(tags, ({many}) => ({
	contentTags: many(contentTags),
}));

export const notificationsRelations = relations(notifications, ({one}) => ({
	user_recipientId: one(user, {
		fields: [notifications.recipientId],
		references: [user.id],
		relationName: "notifications_recipientId_user_id"
	}),
	user_actorId: one(user, {
		fields: [notifications.actorId],
		references: [user.id],
		relationName: "notifications_actorId_user_id"
	}),
}));

export const mediaRelations = relations(media, ({one}) => ({
	user: one(user, {
		fields: [media.uploadedBy],
		references: [user.id]
	}),
}));