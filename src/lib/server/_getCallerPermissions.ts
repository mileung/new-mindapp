import { ranStr } from '$lib/js';
import { m } from '$lib/paraglide/messages';
import { tdb } from '$lib/server/db';
import { getValidAuthCookie, setCookie } from '$lib/server/sessions';
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
		canReact?: boolean;
		canPost?: boolean;
	} = {},
) => {
	if (!get.signedIn && (get.callerRole || get.canReact || get.canPost))
		throw new Error(`must get signed in to get callerRole, canReact, or canPost`);
	if (get.spaceIsPublic && !input.spaceMs) throw new Error(`input.spaceMs must be gt0`);

	let spaceIsPublic = input.spaceMs === 1;
	let signedIn = false;
	let callerRole: null | 'member' | 'mod' | 'owner' = null;
	let canReact = false;
	let canPost = false;

	let ms = Date.now();
	let sessionKey = getValidAuthCookie(ctx, 'sessionKey');
	let sessionKeyTxtMsAtAccountIdFilter: undefined | SQL;
	if (input.callerMs && get.signedIn && sessionKey) {
		sessionKeyTxtMsAtAccountIdFilter = and(
			pf.msAsAtId(input.callerMs),
			pf.msAsId(sessionKey.ms),
			pf.code.eq(pc.sessionKeyTxtMsAtAccountId),
			pf.num.eq0,
			pf.txt.eq(sessionKey.txt),
		);
	}

	let callerId: IdObj = { ms: input.callerMs, by_ms: 0, in_ms: 0 };
	let {
		[pc.spacePublicBinId]: spaceVisibilityIdNumRows = [],
		[pc.sessionKeyTxtMsAtAccountId]: sessionKeyTxtMsAtAccountIdRows = [],
		[pc.acceptMsByMsAtInviteId]: acceptMsByMsAtInviteIdRows = [],
		[pc.promotionToModIdAtAccountId]: promotionToModIdAtAccountIdRows = [],
		[pc.promotionToOwnerIdAtAccountId]: promotionToOwnerIdAtAccountIdRows = [],
		[pc.canReactBinIdAtAccountId]: canReactIdNumAtAccountIdRows = [],
		[pc.canPostBinIdAtAccountId]: canPostIdNumAtAccountIdRows = [],
	} = channelPartsByCode(
		get.spaceIsPublic ||
			(sessionKeyTxtMsAtAccountIdFilter &&
				(get.signedIn || get.callerRole || get.canReact || get.canPost))
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
													pf.at_ms.eq(input.spaceMs), //
													pf.code.eq(pc.spacePublicBinId),
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
														pf.code.eq(pc.acceptMsByMsAtInviteId),
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
										get.canReact
											? and(
													pf.idAsAtId(callerId),
													pf.in_ms.eq(input.spaceMs),
													pf.code.eq(pc.canReactBinIdAtAccountId),
													pf.txt.isNull,
												)
											: undefined,
										get.canPost
											? and(
													pf.idAsAtId(callerId),
													pf.in_ms.eq(input.spaceMs),
													pf.code.eq(pc.canPostBinIdAtAccountId),
													pf.txt.isNull,
												)
											: undefined,
									]
								: []),
						),
					)
			: [],
	);

	let sessionKeyTxtMsAtAccountIdRow = assertLt2Rows(sessionKeyTxtMsAtAccountIdRows);
	if (sessionKeyTxtMsAtAccountIdRow) {
		if (get.signedIn) {
			signedIn = true;
			if (get.callerRole) {
				if (promotionToOwnerIdAtAccountIdRows.length) callerRole = 'owner';
				else if (promotionToModIdAtAccountIdRows.length) callerRole = 'mod';
				else if (acceptMsByMsAtInviteIdRows.length) callerRole = 'member';
			}
			if (get.canReact) {
				canReact = assertLt2Rows(canReactIdNumAtAccountIdRows)?.num === 1;
			}
			if (get.canPost) {
				canPost = assertLt2Rows(canPostIdNumAtAccountIdRows)?.num === 1;
			}
		}
		if (ms - sessionKeyTxtMsAtAccountIdRow.ms > hour) {
			sessionKey = { ms, txt: ranStr() };
			setCookie(ctx, 'sessionKey', JSON.stringify(sessionKey));
			await tdb
				.update(pTable)
				.set(sessionKey)
				.where(
					and(
						pf.at_ms.gt0,
						pf.at_by_ms.eq0,
						pf.at_in_ms.eq0,
						pf.msAsId(sessionKeyTxtMsAtAccountIdRow.ms),
						pf.code.eq(pc.sessionKeyTxtMsAtAccountId),
						pf.num.eq0,
						pf.txt.eq(sessionKeyTxtMsAtAccountIdRow.txt!),
					),
				);
		}
	}

	if (get.spaceIsPublic) {
		let visibilityMsByMsNumAtSpaceIdRow = assertLt2Rows(spaceVisibilityIdNumRows);
		if (visibilityMsByMsNumAtSpaceIdRow) {
			spaceIsPublic = visibilityMsByMsNumAtSpaceIdRow.num === 1;
		} else if (!callerRole) throw new Error(m.spaceNotFound());
	}

	return {
		signedIn,
		spaceIsPublic,
		callerRole,
		canReact,
		canPost,
	};
};
