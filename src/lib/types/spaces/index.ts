import { throwIf, uniqueMapVals } from '$lib/js';
import { and, lt, or } from 'drizzle-orm';
import { z } from 'zod';
import {
	GranularNumPropSchema,
	GranularTxtPropSchema,
	type GranularNumProp,
	type GranularTxtProp,
	type PartInsert,
} from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { pTable } from '../parts/partsTable';

// These are space props shared across its members (and the public if applicable)
export let SpaceSchema = z.strictObject({
	ms: z.number(),
	memberCount: z.number(),
	isPublic: GranularNumPropSchema,
	name: GranularTxtPropSchema,
	description: GranularTxtPropSchema,
	pinnedQuery: GranularTxtPropSchema,
	newMemberPermissionCode: GranularNumPropSchema,
});
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
	admin: 2,
});
export type RoleCode = (typeof roleCodes)[keyof typeof roleCodes];

export let permissionCodes = uniqueMapVals({
	// TODO: use bitmasking if this gets more complex?
	viewOnly: 0,
	reactOnly: 1,
	postOnly: 2,
	reactAndPost: 3,
});
export type PermissionCode = (typeof permissionCodes)[keyof typeof permissionCodes];

export let accentCodes = uniqueMapVals({
	none: 0,
	newPosts: 1,
	newPostsForCaller: 2,
});

// These are space props specific to the caller and only exist for members
export let SpaceContextSchema = z.strictObject({
	ms: z.number(),
	roleCode: GranularNumPropSchema,
	permissionCode: GranularNumPropSchema,
	flair: GranularTxtPropSchema,
	accentCode: z.number(),
	sidePriority: z.number(),
});
export type SpaceContext = z.infer<typeof SpaceContextSchema>;

export let SpaceDotsUpdateSchema = SpaceSchema.pick({
	description: true,
	memberCount: true,
	newMemberPermissionCode: true,
})
	.partial()
	.extend({ ms: z.number() });
export type SpaceDotsUpdate = z.infer<typeof SpaceDotsUpdateSchema>;

export let MySpaceUpdateSchema = z.strictObject({
	ms: z.number(),
	isPublic: GranularNumPropSchema.optional(),
	name: GranularTxtPropSchema.optional(),
	pinnedQuery: GranularTxtPropSchema.optional(),
	// If caller was remove from a public space, the above is still fetched, the below is nulled
	roleCode: GranularNumPropSchema.optional(),
	permissionCode: GranularNumPropSchema.optional(),
	flair: GranularTxtPropSchema.optional(),
	accentCode: z.number().optional(),
	sidePriority: z.number().optional(),
});
export type MySpaceUpdate = z.infer<typeof MySpaceUpdateSchema>;

export let MySpaceUpdateFromSchema = MySpaceUpdateSchema.extend({
	visiting: z.boolean().optional(),
	permissionCode: GranularNumPropSchema.optional(),
	roleCode: GranularNumPropSchema.optional(),
	flair: GranularTxtPropSchema.optional(),
	accentCode: z.number().optional(),
	sidePriority: z.number().optional(),
});
export type MySpaceUpdateFrom = z.infer<typeof MySpaceUpdateFromSchema>;

export let reduceMySpaceUpdateRows = (rows: PartInsert[] = [], spaceMs: number) => {
	let spaceUpdates: MySpaceUpdate = { ms: spaceMs };
	for (let i = 0; i < rows.length; i++) {
		let { code, txt, p1, p2, p3, p4, p5 } = rows[i];
		throwIf(p1 !== spaceMs);
		if (code === pc.imb_spaceIsPublic) {
			spaceUpdates.isPublic = { ms: p2!, num: p4! };
		} else if (code === pc._spaceName_imb) {
			spaceUpdates.name = { ms: p2!, txt: txt! };
		} else if (code === pc._spacePinnedQuery_imb) {
			spaceUpdates.pinnedQuery = { ms: p2!, txt: txt! };
		} else if (code === pc.i_accountMs_permCode_mb) {
			spaceUpdates.permissionCode = { ms: p4!, num: p3! };
		} else if (code === pc.i_accountMs_roleCode_mb) {
			spaceUpdates.roleCode = { ms: p4!, num: p3! };
		} else if (code === pc._flair_i_accountMs_mb) {
			spaceUpdates.flair = { ms: p3!, txt: txt! };
		} else if (code === pc.i_accountMs_accentCode_lastViewMs_sidePriority) {
			spaceUpdates.accentCode = p3!;
			spaceUpdates.sidePriority = p5!;
		}
	}
	return spaceUpdates;
};

export let InviteSchema = z.strictObject({
	ms: z.number(),
	by_ms: z.number(),
	in_ms: z.number(),
	slugEnd: z.string(),
	expiryMs: z.number(),
	useCount: z.number(),
	maxUses: z.number().optional(),
	revoked: z.boolean().optional(),
});
export type Invite = z.infer<typeof InviteSchema>;

export type Membership = {
	// gs.spaceMsToAccountMsToMembershipMap makes
	// invite.in_ms and accept.by_ms unnecessary
	invite: {
		by_ms: number;
		in_ms?: number;
	};
	accept: {
		ms: number;
		by_ms?: number;
	};
	roleCode: GranularNumProp;
	permissionCode: GranularNumProp;
	flair: GranularTxtProp;
};

export let makeMyValidInvitesFilter = (callerMs: number, spaceMs: number, now = Date.now()) =>
	and(
		pf.code.eq(pc._slugEnd_inviteIbm_expiryMs_useCount_maxUses_revokedMs),
		pf.p1.eq(spaceMs),
		pf.p2.eq(callerMs),
		or(
			pf.p4.eq0, //
			pf.p4.gt(now),
		),
		or(
			lt(pTable.p5, pTable.p6),
			pf.p6.eq0, //
		),
		pf.p7.eq0,
	);
