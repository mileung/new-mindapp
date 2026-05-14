import { tdb } from '$lib/server/db';
import { throwIf } from '$lib/server/errors';
import { type WhoWhereObj } from '$lib/types/parts';
import { pTable } from '$lib/types/parts/partsTable';
import { and } from 'drizzle-orm';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { roleCodes } from '../spaces';
import { get_id__accountMs_roleCode } from '../spaces/db-spaces';

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
		let updatee_id__accountMs_roleCode = await get_id__accountMs_roleCode(spaceMs, accountMs);
		throwIf(
			!updatee_id__accountMs_roleCode || callerRoleCodeNum! <= updatee_id__accountMs_roleCode.num,
		);
	}

	let ms = Date.now();
	await tdb
		.update(pTable)
		.set({
			ms,
			by_ms: callerMs,
			txt: flairTxt,
		})
		.where(
			and(pf.atId({ at_ms: accountMs }), pf.in_ms.eq(spaceMs), pf.code.eq(pc.id__accountMs__flair)),
		);
	return { ms };
};
