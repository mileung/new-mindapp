import { gs } from '$lib/global-state.svelte';
import { identikana } from '$lib/js';
import { m } from '$lib/paraglide/messages';
import { and } from 'drizzle-orm';
import { z } from 'zod';
import { type PartInsert } from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';

export let OtherAccountSchema = z
	.object({
		ms: z.number(),
		name: z.string().optional(),
		nameMs: z.number().optional(),
		bio: z.string().optional(),
		bioMs: z.number().optional(),
	})
	.strict();
export type OtherAccount = z.infer<typeof OtherAccountSchema>;

export let MyAccountSchema = OtherAccountSchema.merge(
	z.object({
		email: z.string().optional(),
		emailMs: z.number().optional(),
		savedTags: z.array(z.string()),
		savedTagsMs: z.number().optional(),
		spaceMss: z.array(z.number()),
		spaceMssMs: z.number().optional(),
		// No good reason to include pwHash, pwHashMs, clientKey, or clientKeyMs
		signedIn: z.boolean().optional(),
	}),
)
	.strict()
	.refine(
		(a) =>
			a.ms === 0
				? Object.keys(a).every((key) => ['ms', 'savedTags', 'spaceMss', 'signedIn'].includes(key))
				: true,
		{
			message: 'If ms is 0, the only properties allowed are savedTags and spaceMss',
		},
	);

export type MyAccount = z.infer<typeof MyAccountSchema>;

export let getDefaultAccount = () =>
	({
		ms: 0,
		spaceMss: [],
		savedTags: [],
	}) satisfies MyAccount;

export let reduceAccountRows = (rows: PartInsert[]) => {
	let account: Partial<MyAccount> = {};
	for (let i = 0; i < rows.length; i++) {
		let part = rows[i];
		if (part.code === pc.accountId) {
			account.ms = part.ms!;
		} else if (part.code === pc.emailMsTxtAtAccountId) {
			account.email = part.txt!;
			account.emailMs = part.ms!;
		} else if (part.code === pc.nameMsTxtAtAccountId) {
			account.name = part.txt!;
			account.nameMs = part.ms!;
		} else if (part.code === pc.bioMsTxtAtAccountId) {
			account.bio = part.txt!;
			account.bioMs = part.ms!;
		} else if (part.code === pc.savedTagsMsTxtAtAccountId) {
			account.savedTags = JSON.parse(part.txt!);
			account.savedTagsMs = part.ms!;
		}
		// TODO: get account spaces
		// if (prop === 'spaceMss' || prop === 'savedTags') {
		// 	a[`${prop}Ms`] = row.ms!;
		// 	a[prop] = JSON.parse(row.txt!);
		// }
	}
	return account;
};

export let reduceMyAccountRows = (rows: PartInsert[]) =>
	({
		...getDefaultAccount(), //
		...reduceAccountRows(rows),
	}) satisfies MyAccount;

export let passwordRegexStr = '(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z]).{8,64}';

export let filterAccountPwHashRow = (accountMs: number) =>
	and(
		pf.at_ms.eq(accountMs),
		pf.at_by_ms.eq0,
		pf.at_in_ms.eq0,
		pf.ms.gt0,
		pf.by_ms.eq0,
		pf.in_ms.eq0,
		pf.code.eq(pc.pwHashMsTxtAtAccountId),
		pf.num.eq0,
		pf.txt.isNotNull,
	);

export let accountMsToName = (ms: number, isSystem = false) => {
	return !ms
		? gs.currentSpaceMs || isSystem
			? m.system()
			: m.anon()
		: gs.msToAccountMap[ms]?.name || identikana(ms);
};
