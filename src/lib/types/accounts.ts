import { z } from 'zod';
import { assertLt2Rows, type PartSelect } from './parts';
import { pTable } from '$lib/types/parts/partsTable';
import { and, or } from 'drizzle-orm';
import { pc } from './parts/partCodes';
import { pt } from './parts/partFilters';
import type { Database } from '$lib/local-db';

export let AccountSchema = z
	.object({
		ms: z.number(),
		spaceMss: z.array(z.number()),
		spaceMssMs: z.number().optional(),
		savedTags: z.array(z.string()),
		savedTagsMs: z.number().optional(),
		name: z.string().optional(),
		nameMs: z.number().optional(),
		email: z.string().optional(),
		emailMs: z.number().optional(),
		pwHash: z.string().optional(),
		pwHashMs: z.number().optional(),
		clientId: z.string().optional(),
		clientIdMs: z.number().optional(),
	})
	.strict();

export type Account = z.infer<typeof AccountSchema>;

export let getDefaultAccount = () =>
	({
		ms: 0,
		spaceMss: [
			0, // local space ms - everything local
			8, // placeholder for personal space ms - everything private in cloud
			1, // global space ms - everything public in cloud
			// users can make additional spaces with custom privacy
		],
		savedTags: [],
	}) satisfies Account;

export let reduceAccountRows = (rows: PartSelect[]) => {
	let account: Account = getDefaultAccount();
	for (let i = 0; i < rows.length; i++) {
		let part = rows[i];

		if (part.code === pc.accountId) {
			account.ms = part.ms!;
		} else if (part.code === pc.txtAsAccountPwHashAtAccountId) {
			account.pwHash = part.txt!;
			account.pwHashMs = part.ms!;
		} else if (part.code === pc.msAndTxtAsClientIdAtAccountId) {
			account.clientId = part.txt!;
			account.clientIdMs = part.ms!;
		} else if (part.code === pc.msAndTxtAsNameAtAccountId) {
			account.name = part.txt!;
			account.nameMs = part.ms!;
		} else if (part.code === pc.txtAsAccountEmailAtAccountId) {
			account.email = part.txt!;
			account.emailMs = part.ms!;
		}

		// if (prop === 'spaceMss' || prop === 'savedTags') {
		// 	a[`${prop}Ms`] = row.ms!;
		// 	a[prop] = JSON.parse(row.txt!);
		// }
	}
	return account;
};

export let sanitizeAccountForClient = (a: Account) => ({
	ms: a.ms,
	name: a.name,
});

export let sanitizeAccountForUser = (a: Account) => ({
	ms: a.ms,
	spaceMss: a.spaceMss,
	spaceMssMs: a.spaceMssMs,
	savedTags: a.savedTags,
	savedTagsMs: a.savedTagsMs,
	name: a.name,
	nameMs: a.nameMs,
	email: a.email,
	emailMs: a.emailMs,
});

let emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
export let isValidEmail = (email: string) => {
	return email.length < 255 && emailRegex.test(email);
};

export let assertValidEmail = (e: string) => {
	if (!isValidEmail(e)) throw new Error('invalid email');
};

export let _getEmailRow = async (db: Database, email: string) => {
	let emailRowsFilter = and(
		pt.at_ms.gt0,
		pt.at_by_ms.eq0,
		pt.at_in_ms.eq0,
		pt.ms.gt0,
		pt.by_ms.eq0,
		pt.in_ms.eq0,
		pt.code.eq(pc.txtAsAccountEmailAtAccountId),
		pt.txt.eq(email),
		pt.num.isNull,
	);
	let emailRows = await db.select().from(pTable).where(emailRowsFilter);
	return assertLt2Rows(emailRows);
};

export let _getMyAccount = async (db: Database, ms: number, email: string) => {
	let rowsForAccount = await db
		.select()
		.from(pTable)
		.where(
			or(
				and(
					pt.at_ms.eq0,
					pt.at_by_ms.eq0,
					pt.at_in_ms.eq0,
					pt.ms.eq(ms),
					pt.by_ms.eq0,
					pt.in_ms.eq0,
					pt.code.eq(pc.accountId),
					pt.txt.isNull,
				),
				and(
					pt.at_ms.eq(ms),
					pt.at_by_ms.eq0,
					pt.at_in_ms.eq0,
					pt.ms.gt0,
					pt.by_ms.eq0,
					pt.in_ms.eq0,
					pt.code.eq(pc.txtAsAccountEmailAtAccountId),
					pt.txt.eq(email),
					pt.num.isNull,
				),
				and(
					pt.at_ms.eq(ms),
					pt.at_by_ms.eq0,
					pt.at_in_ms.eq0,
					pt.ms.gt0,
					pt.by_ms.eq0,
					pt.in_ms.eq0,
					or(
						...[
							//
							pt.code.eq(pc.msAndTxtAsNameAtAccountId),
						],
					),
					// eq(partsTable.txt),
					// pf.num.isNull,
				),
			),
		);
	// @ts-ignore
	let account: Account = {
		email, // ...reduceAccountRows(rowsForAccount)
	};
	if (!AccountSchema.safeParse(account)) throw new Error(`Invalid account`);
	return { account };
};

export let filterAccountPwHashRow = (accountMs: number) =>
	and(
		pt.at_ms.eq(accountMs),
		pt.at_by_ms.eq0,
		pt.at_in_ms.eq0,
		pt.ms.gt0,
		pt.by_ms.eq0,
		pt.in_ms.eq0,
		pt.code.eq(pc.txtAsAccountPwHashAtAccountId),
		pt.txt.isNotNull,
		pt.num.isNull,
	);
