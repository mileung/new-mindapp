import { ranStr } from '$lib/js';
import { m } from '$lib/paraglide/messages';
import { tdb } from '$lib/server/db';
import { deleteSessionCookies, getValidSessionCookies, setCookie } from '$lib/server/sessions';
import { hour } from '$lib/time';
import type { Context } from '$lib/trpc/context';
import { assertLt2Rows, channelPartsByCode } from '$lib/types/parts';
import { pc } from '$lib/types/parts/partCodes';
import { pf } from '$lib/types/parts/partFilters';
import { type IdObj } from '$lib/types/parts/partIds';
import { pTable } from '$lib/types/parts/partsTable';
import { and, or, SQL } from 'drizzle-orm';

export let _getCallerPermissions = async (
	ctx: Context,
	input: {
		callerMs: number;
		spaceMs?: number;
	},
	get: {
		spaceIsPublic?: boolean;
		signedIn?: boolean;
		callerRole?: boolean;
		canWrite?: boolean;
	} = {},
) => {
	if (!get.signedIn && (get.callerRole || get.canWrite))
		throw new Error(`must get signed in to get callerRole or canWrite`);
	if (get.spaceIsPublic && !input.spaceMs) throw new Error(`input.spaceMs must be gt0`);

	let spaceIsPublic = input.spaceMs === 1;
	let signedIn = false;
	let callerRole: null | 'member' | 'mod' | 'owner' = null;
	let canWrite = false;

	let ms = Date.now();
	let { sessionMs, sessionKey } = getValidSessionCookies(ctx);
	let sessionKeyTxtMsAtAccountIdFilter: undefined | SQL;
	if (get.signedIn && sessionMs && sessionKey) {
		sessionKeyTxtMsAtAccountIdFilter = and(
			pf.at_ms.eq(input.callerMs),
			pf.at_by_ms.eq0,
			pf.at_in_ms.eq0,
			pf.ms.eq(sessionMs),
			pf.by_ms.eq0,
			pf.in_ms.eq0,
			pf.code.eq(pc.sessionKeyTxtMsAtAccountId),
			pf.num.eq0,
			pf.txt.eq(sessionKey),
		);
	}

	let callerId: IdObj = { ms: input.callerMs, by_ms: 0, in_ms: 0 };
	let {
		[pc.spaceVisibilityIdNum]: spaceVisibilityIdNumRows = [],
		[pc.sessionKeyTxtMsAtAccountId]: sessionKeyTxtMsAtAccountIdRows = [],
		[pc.joinMsByMsAtInviteId]: joinMsByMsAtInviteIdRows = [],
		[pc.promotionToModIdAtAccountId]: promotionToModIdAtAccountIdRows = [],
		[pc.promotionToOwnerIdAtAccountId]: promotionToOwnerIdAtAccountIdRows = [],
		[pc.canWriteIdNumAtAccountId]: canWriteIdNumAtAccountIdRows = [],
	} = channelPartsByCode(
		get.spaceIsPublic ||
			(sessionKeyTxtMsAtAccountIdFilter && (get.signedIn || get.callerRole || get.canWrite))
			? await tdb
					.select()
					.from(pTable)
					.where(
						or(
							sessionKeyTxtMsAtAccountIdFilter,
							...(input.spaceMs
								? [
										get.spaceIsPublic
											? and(
													pf.at_in_ms.eq(input.spaceMs), //
													pf.code.eq(pc.spaceVisibilityIdNum),
													pf.txt.isNull,
												)
											: undefined,
										...(get.callerRole
											? [
													and(
														pf.at_in_ms.eq(input.spaceMs),
														pf.ms.gt0,
														pf.by_ms.eq(input.callerMs),
														pf.in_ms.eq0,
														pf.code.eq(pc.joinMsByMsAtInviteId),
														pf.num.eq0,
														pf.txt.isNull,
													),
													and(
														pf.idAsAtId(callerId),
														pf.ms.gt0,
														pf.in_ms.eq(input.spaceMs),
														pf.code.eq(pc.promotionToModIdAtAccountId),
														pf.num.eq0,
														pf.txt.isNull,
													),
													and(
														pf.idAsAtId(callerId),
														pf.ms.gt0,
														pf.in_ms.eq(input.spaceMs),
														pf.code.eq(pc.promotionToOwnerIdAtAccountId),
														pf.num.eq0,
														pf.txt.isNull,
													),
												]
											: []),
										get.canWrite
											? and(
													pf.idAsAtId(callerId),
													pf.in_ms.eq(input.spaceMs),
													pf.code.eq(pc.canWriteIdNumAtAccountId),
													pf.txt.isNull,
												)
											: undefined,
									]
								: []),
						),
					)
			: [],
	);

	if (get.spaceIsPublic) {
		let visibilityMsByMsNumAtSpaceIdRow = assertLt2Rows(spaceVisibilityIdNumRows);
		if (visibilityMsByMsNumAtSpaceIdRow) {
			spaceIsPublic = visibilityMsByMsNumAtSpaceIdRow.num === 1;
		} else throw new Error(m.spaceNotFound());
	}

	let sessionKeyTxtMsAtAccountIdRow = assertLt2Rows(sessionKeyTxtMsAtAccountIdRows);
	if (sessionKeyTxtMsAtAccountIdRow) {
		if (get.signedIn) {
			signedIn = true;
			if (get.callerRole) {
				if (promotionToOwnerIdAtAccountIdRows.length) callerRole = 'owner';
				else if (promotionToModIdAtAccountIdRows.length) callerRole = 'mod';
				else if (joinMsByMsAtInviteIdRows.length) callerRole = 'member';
			}
			if (get.canWrite) {
				canWrite = assertLt2Rows(canWriteIdNumAtAccountIdRows)?.num === 1;
			}
		}
		if (ms - sessionKeyTxtMsAtAccountIdRow.ms > (hour && 0)) {
			let newSessionKey = ranStr();
			setCookie(ctx, 'sessionMs', '' + ms);
			setCookie(ctx, 'sessionKey', newSessionKey);
			await tdb
				.update(pTable)
				.set({ ms, txt: newSessionKey })
				.where(
					and(
						pf.at_ms.gt0,
						pf.at_by_ms.eq0,
						pf.at_in_ms.eq0,
						pf.ms.eq(sessionKeyTxtMsAtAccountIdRow.ms),
						pf.by_ms.eq0,
						pf.in_ms.eq0,
						pf.code.eq(pc.sessionKeyTxtMsAtAccountId),
						pf.num.eq0,
						pf.txt.eq(sessionKeyTxtMsAtAccountIdRow.txt!),
					),
				);
		}
	} else if ((sessionMs || sessionKey) && (get.callerRole || get.canWrite || get.signedIn)) {
		deleteSessionCookies(ctx);
	}
	return {
		signedIn,
		spaceIsPublic,
		callerRole,
		canWrite,
	};
};
