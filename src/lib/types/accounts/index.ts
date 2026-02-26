import { gs } from '$lib/global-state.svelte';
import { identikana } from '$lib/js';
import { m } from '$lib/paraglide/messages';
import { and } from 'drizzle-orm';
import { z } from 'zod';
import { GranularNumPropSchema, GranularTxtPropSchema, type PartInsert } from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';

export let ProfileSchema = z
	.object({
		ms: z.number(),
		name: GranularTxtPropSchema,
		bio: GranularTxtPropSchema,
		mutualSpaceMss: z.array(z.number()),
	})
	.strict();
export type Profile = z.infer<typeof ProfileSchema>;

export let CallerContextSchema = z.object({
	signedIn: z.boolean().optional(),
	//
	isPublic: GranularNumPropSchema.nullish(),
	pinnedQuery: GranularTxtPropSchema.nullish(),
	roleCode: GranularNumPropSchema.nullish(),
	permissionCode: GranularNumPropSchema.nullish(),
	//
	currentAccountUpdates: z
		.object({
			email: GranularTxtPropSchema.optional(),
			name: GranularTxtPropSchema.optional(),
			bio: GranularTxtPropSchema.optional(),
			savedTags: GranularTxtPropSchema.optional(),
			spaceMss: GranularTxtPropSchema.optional(),
		})
		.optional(),
	signedInAccountMss: z.array(z.number()).optional(),
	sidebarSpaceNames: z.record(z.string(), GranularTxtPropSchema).optional(),
	spaceMssAwaitingResponse: z.array(z.number()).optional(),
});
export type CallerContext = z.infer<typeof CallerContextSchema>;

export let GetCallerContextGetArgSchema = z.object({
	signedIn: z.boolean().optional(),
	//
	isPublic: z.boolean().or(GranularNumPropSchema).optional(),
	pinnedQuery: z.boolean().or(GranularTxtPropSchema).optional(),
	roleCode: z.boolean().or(GranularNumPropSchema).optional(),
	permissionCode: z.boolean().or(GranularNumPropSchema).optional(),
	//
	signedInAccountMssFrom: z.array(z.number().gt(0)).optional(),
	sidebarSpaceNames: z.record(z.number().gt(8), GranularTxtPropSchema).optional(),
	yourTurnIndicatorsFromSpaceMsToLastCheckMsMap: z.record(z.string(), z.number().gt(0)).optional(),
	latestAccountAttributesFromCallerAttributes: z
		.object({
			email: GranularTxtPropSchema,
			name: GranularTxtPropSchema,
			bio: GranularTxtPropSchema,
			savedTags: GranularTxtPropSchema,
			spaceMss: GranularTxtPropSchema,
		})
		.optional(),
});
export type GetCallerContextGetArg = z.infer<typeof GetCallerContextGetArgSchema>;

let SpaceContextSchema = CallerContextSchema.pick({
	isPublic: true,
	pinnedQuery: true,
	roleCode: true,
	permissionCode: true,
}).strict();
export type SpaceContext = z.infer<typeof SpaceContextSchema>;

export let MyAccountSchema = z
	.object({
		ms: z.number(),
		name: GranularTxtPropSchema,
		bio: GranularTxtPropSchema,
		email: GranularTxtPropSchema,
		savedTags: GranularTxtPropSchema,
		spaceMss: GranularTxtPropSchema,

		// No good reason to include pwHash, clientKey, or clientKeyMs

		signedIn: z.boolean().optional(),
		spaceMsToContextMap: z.record(z.string(), SpaceContextSchema.optional()),
		// spaceMssAwaitingResponse: z.array(z.number())
	})
	.strict();

export type MyAccount = z.infer<typeof MyAccountSchema>;

export let getDefaultAccount = () =>
	({
		ms: 0,
		name: { ms: 0, txt: '' },
		bio: { ms: 0, txt: '' },
		email: { ms: 0, txt: '' },
		savedTags: { ms: 0, txt: JSON.stringify([]) },
		spaceMss: { ms: 0, txt: JSON.stringify([]) },
		spaceMsToContextMap: {},
	}) satisfies MyAccount;

export type MyAccountUpdates = Partial<
	Pick<MyAccount, 'ms' | 'email' | 'name' | 'bio' | 'savedTags' | 'spaceMss'>
>;
export let reducePartialAccountRows = (rows: PartInsert[]) => {
	let account: MyAccountUpdates = {};
	for (let i = 0; i < rows.length; i++) {
		let part = rows[i];
		if (part.code === pc.accountEmailTxtMsByMs) {
			account.ms = part.by_ms;
			account.email = { ms: part.ms, txt: part.txt! };
		} else if (part.code === pc.accountNameTxtMsByMs) {
			account.name = { ms: part.ms, txt: part.txt! };
		} else if (part.code === pc.accountBioTxtMsByMs) {
			account.bio = { ms: part.ms, txt: part.txt! };
		} else if (part.code === pc.accountSavedTagsTxtMsByMs) {
			account.savedTags = { ms: part.ms, txt: part.txt! };
		} else if (part.code === pc.accountSpaceMssTxtMsByMs) {
			account.spaceMss = { ms: part.ms, txt: part.txt! };
		}
	}
	return account;
};

export let reduceMyAccountRows = (rows: PartInsert[]) =>
	({
		...getDefaultAccount(), //
		...reducePartialAccountRows(rows),
	}) satisfies MyAccount;

export let passwordRegexStr = '(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z]).{8,64}';

export let filterAccountPwHashRow = (accountMs: number) =>
	and(
		pf.noAtId,
		pf.ms.gt0,
		pf.by_ms.eq(accountMs),
		pf.in_ms.eq0,
		pf.code.eq(pc.accountPwHashTxtMsByMs),
		pf.num.eq0,
		pf.txt.isNotNull,
	);

export let accountMsToNameTxt = (ms: number, isSystem = false) => {
	return !ms
		? isSystem
			? // ? gs.urlInMs || isSystem
				m.system()
			: m.anon()
		: gs.accountMsToNameTxtMap[ms] || identikana(ms);
};
