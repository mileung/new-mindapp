import { ranStr } from '$lib/js';
import { tdb } from '$lib/server/db';
import { type WhoWhereObj } from '../parts';
import { pc } from '../parts/partCodes';
import { id0 } from '../parts/partIds';
import { pTable } from '../parts/partsTable';

export let inviteLinksPerLoad = 88;

export let _createInviteLink = async (
	input: WhoWhereObj & {
		validFor: number;
		maxUses: number;
	},
) => {
	let ms = Date.now();
	let slug = ranStr(42);
	let expiryMs = ms + input.validFor;

	await tdb.insert(pTable).values([
		{
			...id0,
			at_by_ms: expiryMs,
			at_in_ms: input.maxUses,
			ms,
			by_ms: input.callerMs,
			in_ms: input.spaceMs,
			code: pc.inviteIdWithAtByMsAsExpiryAtInMsAsMaxUsesNumAsUseCountAndTxtAsSlug,
			num: 0,
			txt: slug,
		},
	]);

	return {
		ms,
		slug,
		expiryMs,
	};
};
