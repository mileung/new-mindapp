import { tdb } from '$lib/server/db';
import { throwIf } from '$lib/server/errors';
import { type WhoWhereObj } from '$lib/types/parts';
import { pTable } from '$lib/types/parts/partsTable';
import { and } from 'drizzle-orm';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { roleCodes } from '../spaces';
import { get_roleCodeNumIdAtAccountId } from '../spaces/db-spaces';

export let _setSpaceMemberFlair = async ({
	spaceMs,
	callerMs,
	accountMs,
	callerRoleCodeNum,
	flairTxt,
}: WhoWhereObj & {
	accountMs: number;
	callerRoleCodeNum: number;
	flairTxt: string;
}) => {
	if (callerMs !== accountMs) {
		throwIf(
			callerRoleCodeNum !== roleCodes.mod && //
				callerRoleCodeNum !== roleCodes.owner,
		);
		let updatee_roleCodeNumIdAtAccountId = await get_roleCodeNumIdAtAccountId(spaceMs, accountMs);
		throwIf(
			!updatee_roleCodeNumIdAtAccountId ||
				callerRoleCodeNum <= updatee_roleCodeNumIdAtAccountId.num,
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
			and(
				pf.atId({ at_ms: accountMs }),
				pf.in_ms.eq(spaceMs),
				pf.code.eq(pc.flairTxtIdAtAccountId),
			),
		);
	return { ms };
};
