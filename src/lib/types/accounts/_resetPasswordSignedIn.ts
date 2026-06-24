import { throwIf } from '$lib/js';
import { tdb } from '$lib/server/db';
import { pTable } from '$lib/types/parts/partsTable';
import * as argon2 from 'argon2';
import { and } from 'drizzle-orm';
import { assert1Row, type WhoObj } from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';

export let _resetPasswordSignedIn = async (
	input: WhoObj & {
		oldPassword: string;
		newPassword: string;
	},
) => {
	let _accountPwHash_bmFilter = and(
		pf.code.eq(pc._accountPwHash_bm),
		pf.p1.eq(input.callerMs), //
	);
	let _accountPwHash_bmRow = assert1Row(
		await tdb //
			.select()
			.from(pTable)
			.where(_accountPwHash_bmFilter),
	);
	throwIf(!(await argon2.verify(_accountPwHash_bmRow.txt!, input.oldPassword)));
	await tdb
		.update(pTable)
		.set({
			txt: await argon2.hash(input.newPassword),
			p2: Date.now(),
		})
		.where(_accountPwHash_bmFilter);
	return { success: true };
};
