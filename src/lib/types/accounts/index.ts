import { and } from 'drizzle-orm';
import { z } from 'zod';
import { GranularNumPropSchema, GranularTxtPropSchema, type PartInsert } from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { MySpaceUpdateFromSchema, MySpaceUpdateSchema, SpaceContextSchema } from '../spaces';

export let MyAccountSchema = z.strictObject({
	ms: z.number(),
	name: GranularTxtPropSchema,
	bio: GranularTxtPropSchema,
	email: GranularTxtPropSchema,
	savedTags: GranularTxtPropSchema,
	// No good reason to include pwHash, clientIdObj, or clientIdObjMs
	signedIn: z.boolean().optional(),
	joinedSpaceContexts: z.array(SpaceContextSchema),
	// TODO: pastSearches: z.array(z.string()),
});

export type MyAccount = z.infer<typeof MyAccountSchema>;

export let getDefaultAccount = () =>
	({
		ms: 0,
		name: { txt: '' },
		bio: { txt: '' },
		email: { txt: '' },
		savedTags: { txt: JSON.stringify([]) },
		joinedSpaceContexts: [],
	}) satisfies MyAccount;

export let MyAccountUpdatesSchema = MyAccountSchema.pick({
	email: true,
	name: true,
	bio: true,
	savedTags: true,
})
	.partial()
	.extend({ ms: z.number() });
export type MyAccountUpdates = z.infer<typeof MyAccountUpdatesSchema>;

export let reduceMyAccountUpdateRows = (rows: PartInsert[]) => {
	let account: MyAccountUpdates = { ms: 0 };
	for (let i = 0; i < rows.length; i++) {
		let part = rows[i];
		!i && (account.ms = part.by_ms);
		if (part.code === pc.msByMs__accountEmail) {
			account.email = { ms: part.ms, txt: part.txt! };
		} else if (part.code === pc.msByMs__accountName) {
			account.name = { ms: part.ms, txt: part.txt! };
		} else if (part.code === pc.msByMs__accountBio) {
			account.bio = { ms: part.ms, txt: part.txt! };
		} else if (part.code === pc.msByMs__accountSavedTags) {
			account.savedTags = { ms: part.ms, txt: part.txt! };
		}
	}
	return account;
};
export let reduceMyAccountRows = (rows: PartInsert[]) =>
	({
		...getDefaultAccount(), //
		...reduceMyAccountUpdateRows(rows),
	}) satisfies MyAccount;

export let PublicProfileSchema = z.strictObject({
	ms: z.number(),
	name: GranularTxtPropSchema,
	bio: GranularTxtPropSchema.optional(),
	callerMsToMutualSpaceMsToJoinMsMap: z
		.record(z.number(), z.record(z.number(), z.number()).optional())
		.optional(),
	banned: z
		.object({
			ms: z.number(), //
			by_ms: z.number().optional(),
			bannerNameTxt: z.string().optional(),
		})
		.optional(),
	email: GranularTxtPropSchema.optional(), // email should only be visible to owners
});
export type PublicProfile = z.infer<typeof PublicProfileSchema>;

export let GetCallerContextGetArgSchema = z.strictObject({
	signedIn: z.boolean().optional(),
	//
	isPublic: z.boolean().optional(),
	roleCode: z.boolean().optional(),
	permissionCode: z.boolean().optional(),
	//
	inGlobal: z.boolean().optional(),
	//
	allJoinedSpaces: z.boolean().optional(),
	spaceUpdatesFrom: z.array(MySpaceUpdateFromSchema).optional(), // TODO: enforce .max(8) on backend
	signedInAccountUpdatesFrom: z.array(MyAccountUpdatesSchema).optional(), // TODO: enforce .max(888) on backend (paginate past 888 joined spaces later?)
});
export type GetCallerContextGetArg = z.infer<typeof GetCallerContextGetArgSchema>;

export let CallerContextSchema = z.strictObject({
	signedIn: z.boolean().optional(),
	isPublic: GranularNumPropSchema.optional(),
	roleCode: GranularNumPropSchema.optional(),
	permissionCode: GranularNumPropSchema.optional(),
	inGlobal: z.boolean().optional(),

	visitingPublicSpaceUpdate: MySpaceUpdateSchema.optional(),
	removedSpaceMss: z.array(z.number()).optional(),
	signedOutAccountMss: z.array(z.number()).optional(),
	spaceUpdates: z.array(MySpaceUpdateSchema).optional(),
	signedInAccountUpdates: z.array(MySpaceUpdateSchema).optional(),
	// msToViewableSpaceUpdateMap: z.record(z.number(), MySpaceUpdatesSchema.optional()),
	// msToSignedInAccountUpdateMap: z.record(z.number(), MyAccountUpdatesSchema.optional()),
});
export type CallerContext = z.infer<typeof CallerContextSchema>;

export let getDefaultCallerContext = (): CallerContext => ({
	spaceUpdates: [], //
	signedInAccountUpdates: [],
});

export let passwordRegexStr = '(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z]).{8,64}';

export let filterAccountPwHashRow = (accountMs: number) =>
	and(
		pf.noAtId,
		pf.ms.gt0,
		pf.by_ms.eq(accountMs),
		pf.in_ms.eq0,
		pf.code.eq(pc.msByMs__accountPwHash),
		pf.num.isNull,
		pf.txt.isNotNull,
	);
