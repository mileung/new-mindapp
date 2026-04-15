import { m } from '$lib/paraglide/messages';
import { tdb } from '$lib/server/db';
import { filterAccountPwHashRow } from '$lib/types/accounts';
import { pTable } from '$lib/types/parts/partsTable';
import * as argon2 from 'argon2';
import { assert1Row, type WhoObj } from '../parts';

export let _resetPasswordSignedIn = async (
	input: WhoObj & {
		oldPassword: string;
		newPassword: string;
	},
) => {
	let accountPwHashRowFilter = filterAccountPwHashRow(input.callerMs);

	let pwHashRow = assert1Row(
		await tdb //
			.select()
			.from(pTable)
			.where(accountPwHashRowFilter),
	);
	if (!(await argon2.verify(pwHashRow.txt!, input.oldPassword)))
		throw new Error(m.anErrorOccurred());

	await tdb
		.update(pTable)
		.set({
			ms: Date.now(),
			txt: await argon2.hash(input.newPassword),
		})
		.where(accountPwHashRowFilter);
	return { success: true };
};
