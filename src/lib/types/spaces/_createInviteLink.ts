import { ranStr } from '$lib/js';
import { m } from '$lib/paraglide/messages';
import { tdb } from '$lib/server/db';
import { makeMyValidInvitesFilter } from '.';
import { type WhoWhereObj } from '../parts';
import { pc } from '../parts/partCodes';
import { pTable } from '../parts/partsTable';

let validInviteLimit = 88;

export let _createInviteLink = async (
	input: WhoWhereObj & {
		validFor: number;
		maxUses: number;
	},
) => {
	let now = Date.now();
	let slugEnd = ranStr(8);
	let expiryMs = input.validFor ? now + input.validFor : 0;

	if (input.spaceMs === input.callerMs) throw new Error(`Cannot invite people to personal space`);

	let myInviteRows = await tdb
		.select()
		.from(pTable)
		.where(makeMyValidInvitesFilter(input.callerMs, input.spaceMs, now))
		.limit(validInviteLimit);
	if (myInviteRows.length >= validInviteLimit) throw new Error(m.limitReached());

	await tdb.insert(pTable).values({
		code: pc._slugEnd_inviteIbm_expiryMs_useCount_maxUses_revokedMs,
		txt: slugEnd,
		p1: input.spaceMs,
		p2: input.callerMs,
		p3: now,
		p4: expiryMs,
		p5: 0,
		p6: input.maxUses,
		p7: 0,
	});

	return {
		ms: now,
		slugEnd,
		expiryMs,
	};
};
