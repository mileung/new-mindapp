import { ranStr } from '$lib/js';
import { m } from '$lib/paraglide/messages';
import { tdb } from '$lib/server/db';
import { makeMyValidInvitesFilter } from '.';
import { type WhoWhereObj } from '../parts';
import { pc } from '../parts/partCodes';
import { id0 } from '../parts/partIds';
import { pTable } from '../parts/partsTable';

let validInviteLimit = 88;

export let _createInviteLink = async (
	input: WhoWhereObj & {
		validFor: number;
		maxUses: number;
	},
) => {
	let ms = Date.now();
	let slugEnd = ranStr(8);
	let expiryMs = input.validFor ? ms + input.validFor : 0;

	if (input.spaceMs === input.callerMs) throw new Error(`Cannot invite people to personal space`);

	let myInviteRows = await tdb
		.select()
		.from(pTable)
		.where(makeMyValidInvitesFilter(input.callerMs, input.spaceMs, ms))
		.limit(validInviteLimit);
	if (myInviteRows.length >= validInviteLimit) throw new Error(m.limitReached());

	await tdb.insert(pTable).values([
		{
			...id0,
			at_ms: expiryMs,
			at_in_ms: input.maxUses,
			ms,
			by_ms: input.callerMs,
			in_ms: input.spaceMs,
			code: pc.inviteIdAtExpiryMs_UseCount_MaxUsesIdAndNumAsRevokedMsAndSlugEndTxt,
			num: 0,
			txt: slugEnd,
		},
	]);

	return {
		ms,
		slugEnd,
		expiryMs,
	};
};
