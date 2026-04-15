import { uniqueMapVals } from '$lib/js';
import { and, lt, or } from 'drizzle-orm';
import { z } from 'zod';
import { GranularNumPropSchema, GranularTxtPropSchema, type PartInsert } from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { pTable } from '../parts/partsTable';

// These are space props shared across its members (and the public if applicable)
export let SpaceSchema = z
	.object({
		ms: z.number(),
		memberCount: z.number(),
		isPublic: GranularNumPropSchema,
		name: GranularTxtPropSchema,
		description: GranularTxtPropSchema,
		pinnedQuery: GranularTxtPropSchema,
		newMemberPermissionCode: GranularNumPropSchema,
	})
	.strict();
export type Space = z.infer<typeof SpaceSchema>;

export let getDefaultSpace = () =>
	({
		ms: 0,
		memberCount: 0,
		isPublic: { num: 0 },
		name: { txt: '' },
		description: { txt: '' },
		pinnedQuery: { txt: '' },
		newMemberPermissionCode: { num: 0 },
	}) satisfies Space;

export let roleCodes = uniqueMapVals({
	member: 0,
	mod: 1,
	owner: 2,
});
export let permissionCodes = uniqueMapVals({
	// TODO: use bitmasking if this gets more complex?
	viewOnly: 0,
	reactOnly: 1,
	postOnly: 2,
	reactAndPost: 3,
});
export let accentCodes = uniqueMapVals({
	// TODO: use bitmasking if this gets more complex?
	disabled: 0,
	none: 1,
	newPosts: 2,
	ignoredPostsForYou: 3,
	unreadPostsForYou: 4, // Either a someone else replied one of your posts or someone included your profile slug in their core
});

// These are space props specific to the caller and only exist for members
export let SpaceContextSchema = z
	.object({
		ms: z.number(),
		roleCode: GranularNumPropSchema,
		permissionCode: GranularNumPropSchema,
		accentCode: GranularNumPropSchema,
	})
	.strict();
export type SpaceContext = z.infer<typeof SpaceContextSchema>;

export let SpaceDotsUpdateSchema = SpaceSchema.pick({
	description: true,
	memberCount: true,
	newMemberPermissionCode: true,
})
	.partial()
	.extend({ ms: z.number() });
export type SpaceDotsUpdate = z.infer<typeof SpaceDotsUpdateSchema>;

export let MySpaceUpdateSchema = z.object({
	ms: z.number(),
	isPublic: GranularNumPropSchema.optional(),
	name: GranularTxtPropSchema.optional(),
	pinnedQuery: GranularTxtPropSchema.optional(),
	// If caller was remove from a public space, the above is still fetched, the below is nulled
	permissionCode: GranularNumPropSchema.optional(),
	roleCode: GranularNumPropSchema.optional(),
	accentCode: GranularNumPropSchema.optional(),
});
export type MySpaceUpdate = z.infer<typeof MySpaceUpdateSchema>;

export let MySpaceUpdateFromSchema = MySpaceUpdateSchema.extend({
	permissionCode: GranularNumPropSchema.optional(),
	roleCode: GranularNumPropSchema.optional(),
	accentCode: GranularNumPropSchema.optional(),
});
export type MySpaceUpdateFrom = z.infer<typeof MySpaceUpdateFromSchema>;

export let reduceMySpaceUpdateRows = (rows: PartInsert[]) => {
	let spaceUpdates: MySpaceUpdate = { ms: 0 };
	for (let i = 0; i < rows.length; i++) {
		let part = rows[i];
		!i && (spaceUpdates.ms = part.in_ms);
		if (part.code === pc.spaceIsPublicBinId) {
			spaceUpdates.isPublic = { ms: part.ms, num: part.num };
		} else if (part.code === pc.spaceNameTxtId) {
			spaceUpdates.name = { ms: part.ms, txt: part.txt! };
		} else if (part.code === pc.spacePinnedQueryTxtId) {
			spaceUpdates.pinnedQuery = { ms: part.ms, txt: part.txt! };
		} else if (part.code === pc.permissionCodeNumIdAtAccountId) {
			spaceUpdates.permissionCode = { ms: part.ms, num: part.num };
		} else if (part.code === pc.roleCodeNumIdAtAccountId) {
			spaceUpdates.roleCode = { ms: part.ms, num: part.num };
		} else if (part.code === pc.spacePriorityIdAccentCodeNumAtAccountId) {
			spaceUpdates.accentCode = { ms: part.ms, num: part.num };
		}
	}
	return spaceUpdates;
};

export let InviteSchema = z
	.object({
		ms: z.number(),
		by_ms: z.number(),
		in_ms: z.number(),
		slugEnd: z.string(),
		expiryMs: z.number(),
		useCount: z.number(),
		maxUses: z.number().optional(),
		revoked: z.boolean().optional(),
	})
	.strict();
export type Invite = z.infer<typeof InviteSchema>;

export type Membership = {
	invite: {
		by_ms: number;
		in_ms: number;
	};
	accept: {
		ms: number;
		by_ms: number;
	};
	permission: {
		num: number;
		ms: number;
		by_ms: number;
	};
	// role: {
	// 	num: number;
	// 	ms: number;
	// 	by_ms: number;
	// };
};

export let makeMyValidInvitesFilter = (callerMs: number, spaceMs: number, now = Date.now()) =>
	and(
		or(pf.at_ms.eq0, pf.at_ms.gt(now)),
		or(pf.at_in_ms.eq0, lt(pTable.at_by_ms, pTable.at_in_ms)),
		pf.ms.gt0,
		pf.by_ms.eq(callerMs),
		pf.in_ms.eq(spaceMs),
		pf.code.eq(pc.inviteIdAtExpiryMs_UseCount_MaxUsesIdAndNumAsRevokedMsAndSlugEndTxt),
		pf.num.eq0,
		pf.txt.isNotNull,
	);
