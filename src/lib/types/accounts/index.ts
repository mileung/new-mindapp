import { gs } from '$lib/global-state.svelte';
import { identikana } from '$lib/js';
import { m } from '$lib/paraglide/messages';
import { and } from 'drizzle-orm';
import { z } from 'zod';
import { GranularTxtPropSchema, type PartInsert } from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';

export let OtherAccountSchema = z
	.object({
		ms: z.number(),
		name: GranularTxtPropSchema,
		bio: GranularTxtPropSchema.optional(),
	})
	.strict();
export type OtherAccount = z.infer<typeof OtherAccountSchema>;

export let MyAccountSchema = OtherAccountSchema.merge(
	z.object({
		bio: GranularTxtPropSchema,
		email: GranularTxtPropSchema,
		savedTags: GranularTxtPropSchema,
		spaceMss: GranularTxtPropSchema,

		// No good reason to include pwHash, clientKey, or clientKeyMs
		signedIn: z.boolean().optional(),
	}),
).strict();

export type MyAccount = z.infer<typeof MyAccountSchema>;

export let getDefaultAccount = () =>
	({
		ms: 0,
		name: { ms: 0, txt: '' },
		bio: { ms: 0, txt: '' },
		email: { ms: 0, txt: '' },
		savedTags: { ms: 0, txt: JSON.stringify([]) },
		spaceMss: { ms: 0, txt: JSON.stringify([]) },
	}) satisfies MyAccount;

export type MyAccountUpdates = Partial<MyAccount>;
export let reduceAccountRows = (rows: PartInsert[]) => {
	let account: MyAccountUpdates = {};
	for (let i = 0; i < rows.length; i++) {
		let part = rows[i];
		if (part.code === pc.accountId) {
			account.ms = part.ms!;
		} else if (part.code === pc.emailTxtMsAtAccountId) {
			account.email = { ms: part.ms, txt: part.txt! };
		} else if (part.code === pc.nameTxtMsAtAccountId) {
			account.name = { ms: part.ms, txt: part.txt! };
		} else if (part.code === pc.bioTxtMsAtAccountId) {
			account.bio = { ms: part.ms, txt: part.txt! };
		} else if (part.code === pc.savedTagsTxtMsAtAccountId) {
			account.savedTags = { ms: part.ms, txt: part.txt! };
		} else if (part.code === pc.spaceMssTxtMsAtAccountId) {
			account.spaceMss = { ms: part.ms, txt: part.txt! };
		}
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
		pf.msAsAtId(accountMs),
		pf.ms.gt0,
		pf.by_ms.eq0,
		pf.in_ms.eq0,
		pf.code.eq(pc.pwHashTxtMsAtAccountId),
		pf.num.eq0,
		pf.txt.isNotNull,
	);

export let msToAccountNameTxt = (ms: number, isSystem = false) => {
	return !ms
		? isSystem
			? // ? gs.currentSpaceMs || isSystem
				m.system()
			: m.anon()
		: gs.msToAccountNameTxtMap[ms] || identikana(ms);
};
