import { throwIf } from '$lib/js';
import { tdb } from '$lib/server/db';
import { type WhoWhereObj } from '$lib/types/parts';
import { pTable } from '$lib/types/parts/partsTable';
import { and } from 'drizzle-orm';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { roleCodes } from '../spaces';
import { getRow4i_accountMs_roleCode_mb } from '../spaces/db-spaces';

export let _setSpaceMemberFlair = async (
	{
		spaceMs,
		callerMs,
		accountMs,
		callerRoleCodeNum,
		flairTxt,
	}: WhoWhereObj & {
		accountMs: number;
		callerRoleCodeNum?: number;
		flairTxt: string;
	},
	ownerCalled: boolean,
) => {
	if (!ownerCalled && callerMs !== accountMs) {
		throwIf(
			callerRoleCodeNum !== roleCodes.mod && //
				callerRoleCodeNum !== roleCodes.admin,
		);
		let i_accountMs_roleCode_mbUpdateeRow = await getRow4i_accountMs_roleCode_mb(
			spaceMs,
			accountMs,
		);
		throwIf(
			!i_accountMs_roleCode_mbUpdateeRow ||
				callerRoleCodeNum! <= i_accountMs_roleCode_mbUpdateeRow.p3!,
		);
	}
	let now = Date.now();
	await tdb
		.update(pTable)
		.set({
			txt: flairTxt,
			p3: now,
			p4: callerMs,
		})
		.where(
			and(
				pf.code.eq(pc._flair_i_accountMs_mb),
				pf.p1.eq(spaceMs), //
				pf.p2.eq(accountMs),
			),
		);
	return { ms: now };
};
