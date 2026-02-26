import { ranStr } from '$lib/js';
import { tdb } from '$lib/server/db';
import { deleteSessionKeyCookie, getValidAuthCookie, setCookie } from '$lib/server/sessions';
import { hour, week } from '$lib/time';
import type { Context } from '$lib/trpc/context';
import {
	reducePartialAccountRows,
	type CallerContext,
	type GetCallerContextGetArg,
	type MyAccountUpdates,
} from '$lib/types/accounts';
import {
	assertLt2Rows,
	channelPartsByCode,
	type GranularNumProp,
	type GranularTxtProp,
} from '$lib/types/parts';
import { pc } from '$lib/types/parts/partCodes';
import { pf } from '$lib/types/parts/partFilters';
import { pTable } from '$lib/types/parts/partsTable';
import { permissionCodes, roleCodes } from '$lib/types/spaces';
import { and, or, SQL } from 'drizzle-orm';

export let _getCallerContext = async (
	ctx: Context,
	input: {
		callerMs: number;
		spaceMs?: number;
	},
	get: GetCallerContextGetArg,
) => {
	if (!get.signedIn && (get.roleCode || get.permissionCode))
		throw new Error('must get signed in to get callerRole or permissionCode');
	if (get.isPublic && !input.spaceMs) throw new Error('input.spaceMs must be gt0');
	if (get.permissionCode && !get.roleCode)
		throw new Error('must get permissionCode to get roleCode');
	if (get.pinnedQuery && !get.isPublic) throw new Error('Must get isPublic to get pinnedQuery');

	let signedIn: undefined | boolean;
	let isPublic: undefined | null | GranularNumProp;
	let pinnedQuery: undefined | null | GranularTxtProp;
	let roleCode: undefined | null | GranularNumProp;
	let permissionCode: undefined | null | GranularNumProp;

	let currentAccountUpdates: undefined | MyAccountUpdates;
	let signedInAccountMss: undefined | number[];
	let spaceMssAwaitingResponse: undefined | number[];

	let ms = Date.now();
	let sessionKey = getValidAuthCookie(ctx, 'sessionKey');
	let sessionKeyTxtMsAtAccountIdFilter: undefined | SQL;

	if (input.callerMs && get.signedIn && sessionKey && ms - sessionKey.ms < week) {
		sessionKeyTxtMsAtAccountIdFilter = and(
			pf.atId({ at_ms: input.callerMs }),
			pf.id({ ms: sessionKey.ms }),
			pf.code.eq(pc.sessionKeyTxtMsAtAccountId),
			pf.num.eq0,
			pf.txt.eq(sessionKey.txt),
		);
	}

	let signedInAccountMssFilter: undefined | SQL;
	if (sessionKey && (get.signedInAccountMssFrom || (input.callerMs && get.signedIn))) {
		let accountMss = [
			...new Set([
				...(get.signedInAccountMssFrom || []),
				...(input.callerMs > 0 ? [input.callerMs] : []),
			]),
		];

		signedInAccountMssFilter = and(
			or(...accountMss.map((ms) => pf.atId({ at_ms: ms }))),
			pf.id({ ms: sessionKey.ms }),
			pf.code.eq(pc.sessionKeyTxtMsAtAccountId),
			pf.num.eq0,
			pf.txt.eq(sessionKey.txt),
		);
	}

	let yourTurnIndicatorsFilter: undefined | SQL;
	if (get.yourTurnIndicatorsFromSpaceMsToLastCheckMsMap) {
	}

	let accountUpdatesFilter: undefined | SQL;
	if (get.latestAccountAttributesFromCallerAttributes) {
		let { email, name, bio, savedTags, spaceMss } = get.latestAccountAttributesFromCallerAttributes;
		accountUpdatesFilter = or(
			and(
				pf.noAtId,
				or(pf.ms.notEq(email.ms || 0), pf.txt.notEq(email.txt)),
				pf.by_ms.eq(input.callerMs),
				pf.in_ms.eq0,
				pf.code.eq(pc.accountEmailTxtMsByMs),
				pf.num.eq0,
			),
			and(
				pf.noAtId,
				or(pf.ms.notEq(name.ms || 0), pf.txt.notEq(name.txt)),
				pf.by_ms.eq(input.callerMs),
				pf.in_ms.eq0,
				pf.code.eq(pc.accountNameTxtMsByMs),
				pf.num.eq0,
			),
			and(
				pf.noAtId,
				or(pf.ms.notEq(bio.ms || 0), pf.txt.notEq(bio.txt)),
				pf.by_ms.eq(input.callerMs),
				pf.in_ms.eq0,
				pf.code.eq(pc.accountBioTxtMsByMs),
				pf.num.eq0,
			),
			and(
				pf.noAtId,
				or(pf.ms.notEq(savedTags.ms || 0), pf.txt.notEq(savedTags.txt)),
				pf.by_ms.eq(input.callerMs),
				pf.in_ms.eq0,
				pf.code.eq(pc.accountSavedTagsTxtMsByMs),
				pf.num.eq0,
			),
			and(
				pf.noAtId,
				or(pf.ms.notEq(spaceMss.ms || 0), pf.txt.notEq(spaceMss.txt)),
				pf.by_ms.eq(input.callerMs),
				pf.in_ms.eq0,
				pf.code.eq(pc.accountSpaceMssTxtMsByMs),
				pf.num.eq0,
			),
		);
	}

	let filters = [
		sessionKeyTxtMsAtAccountIdFilter,
		...(input.spaceMs
			? [
					get.isPublic && input.spaceMs > 1 && input.spaceMs !== input.callerMs
						? and(
								pf.in_ms.eq(input.spaceMs), //
								get.isPublic === true ? undefined : pf.num.notEq(get.isPublic.num),
								pf.code.eq(pc.spaceIsPublicBinId),
								pf.txt.isNull,
							)
						: undefined,
					get.pinnedQuery
						? and(
								pf.in_ms.eq(input.spaceMs), //
								get.pinnedQuery === true
									? undefined
									: or(
											pf.ms.notEq(get.pinnedQuery.ms || 0),
											pf.txt.notEq(get.pinnedQuery.txt), //
										),
								pf.code.eq(pc.spacePinnedQueryTxtId),
								pf.txt.isNotNull,
							)
						: undefined,
					get.roleCode && input.spaceMs && input.spaceMs !== input.callerMs
						? and(
								pf.atId({ at_ms: input.callerMs }),
								pf.ms.gt0,
								pf.in_ms.eq(input.spaceMs),
								pf.code.eq(pc.roleCodeNumIdAtAccountId),
								pf.txt.isNull,
							)
						: undefined,
					get.permissionCode && input.spaceMs && input.spaceMs !== input.callerMs
						? and(
								pf.atId({ at_ms: input.callerMs }),
								pf.ms.gt0,
								pf.in_ms.eq(input.spaceMs),
								pf.code.eq(pc.permissionCodeNumIdAtAccountId),
								get.permissionCode === true
									? undefined
									: or(
											pf.ms.notEq(get.permissionCode.ms || 0),
											pf.num.notEq(get.permissionCode.num), //
										),
								pf.txt.isNull,
							)
						: undefined,
				]
			: []),
		signedInAccountMssFilter,
		yourTurnIndicatorsFilter,
		accountUpdatesFilter,
	];

	let {
		[pc.sessionKeyTxtMsAtAccountId]: sessionKeyTxtMsAtAccountIdRows = [],

		[pc.spaceIsPublicBinId]: spaceIsPublicBinIdRows = [],
		[pc.spacePinnedQueryTxtId]: spacePinnedQueryTxtIdRows = [],
		[pc.roleCodeNumIdAtAccountId]: roleCodeNumIdAtAccountIdRows = [],
		[pc.permissionCodeNumIdAtAccountId]: permissionNumIdAtAccountIdRows = [],

		[pc.accountEmailTxtMsByMs]: emailTxtMsAtAccountIdRows = [],
		[pc.accountNameTxtMsByMs]: nameTxtMsAtAccountIdRows = [],
		[pc.accountBioTxtMsByMs]: bioTxtMsAtAccountIdRows = [],
		[pc.accountSavedTagsTxtMsByMs]: savedTagsTxtMsAtAccountIdRows = [],
		[pc.accountSpaceMssTxtMsByMs]: spaceMssTxtMsAtAccountIdRows = [],
	} = channelPartsByCode(
		filters.some((f) => f)
			? await tdb
					.select()
					.from(pTable)
					.where(or(...filters))
			: [],
	);

	// console.log('sessionKeyTxtMsAtAccountIdRows:', sessionKeyTxtMsAtAccountIdRows);
	let sessionKeyTxtMsAtAccountIdRowForCaller = sessionKeyTxtMsAtAccountIdRows.find(
		(row) => row.at_ms === input.callerMs,
	);

	if (sessionKeyTxtMsAtAccountIdRowForCaller) {
		if (get.signedIn) {
			signedIn = true;
			if (get.roleCode) {
				if (input.spaceMs === input.callerMs) roleCode = { num: roleCodes.owner };
				else {
					let roleCodeNumIdAtAccountIdRow = assertLt2Rows(roleCodeNumIdAtAccountIdRows);
					if (roleCodeNumIdAtAccountIdRow) {
						roleCode = {
							ms: roleCodeNumIdAtAccountIdRow.ms,
							num: roleCodeNumIdAtAccountIdRow.num,
						};
					} else roleCode = null;
				}
			}
			if (get.permissionCode) {
				if (input.spaceMs === input.callerMs) {
					permissionCode = { num: permissionCodes.reactAndPost };
				} else {
					let permissionNumIdAtAccountIdRow = assertLt2Rows(permissionNumIdAtAccountIdRows);
					if (permissionNumIdAtAccountIdRow) {
						permissionCode = {
							ms: permissionNumIdAtAccountIdRow.ms,
							num: permissionNumIdAtAccountIdRow.num,
						};
					} else if (!roleCode) permissionCode = null;
				}
			}
		}
		if (ms - sessionKeyTxtMsAtAccountIdRowForCaller.ms > hour) {
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
						pf.id({ ms: sessionKeyTxtMsAtAccountIdRowForCaller.ms }),
						pf.code.eq(pc.sessionKeyTxtMsAtAccountId),
						pf.num.eq0,
						pf.txt.eq(sessionKeyTxtMsAtAccountIdRowForCaller.txt!),
					),
				);
		}
	}

	if (get.isPublic) {
		if (input.spaceMs === 1 && (get.isPublic === true || !get.isPublic.num)) isPublic = { num: 1 };
		else {
			let spaceIsPublicBinIdRow = assertLt2Rows(spaceIsPublicBinIdRows);
			if (spaceIsPublicBinIdRow) {
				isPublic =
					spaceIsPublicBinIdRow.num || roleCode
						? { ms: spaceIsPublicBinIdRow.ms, num: spaceIsPublicBinIdRow.num }
						: null;
			}
		}
	}

	if (get.pinnedQuery) {
		let spacePinnedQueryTxtIdRow = assertLt2Rows(spacePinnedQueryTxtIdRows);
		if (spacePinnedQueryTxtIdRow) {
			pinnedQuery =
				isPublic?.num || roleCode
					? { ms: spacePinnedQueryTxtIdRow.ms, txt: spacePinnedQueryTxtIdRow.txt! }
					: null;
		}
	}

	if (signedIn) {
		if (get.sidebarSpaceNames) {
			//
		}
		if (get.yourTurnIndicatorsFromSpaceMsToLastCheckMsMap) {
			//
		}
		if (get.latestAccountAttributesFromCallerAttributes) {
			let updatedRows = [
				...emailTxtMsAtAccountIdRows,
				...nameTxtMsAtAccountIdRows,
				...bioTxtMsAtAccountIdRows,
				...savedTagsTxtMsAtAccountIdRows,
				...spaceMssTxtMsAtAccountIdRows,
			];
			if (updatedRows.length) currentAccountUpdates = reducePartialAccountRows(updatedRows);
		}
	}

	if (get.signedInAccountMssFrom)
		signedInAccountMss = sessionKeyTxtMsAtAccountIdRows.map((r) => r.at_ms);

	if (get.signedIn && !signedIn) deleteSessionKeyCookie(ctx);

	if (get.roleCode && get.roleCode !== true) {
		// If get.roleCode, roleCode must always be fetched fresh in case
		// the caller is no longer a member of the space
		if (roleCode?.num === get.roleCode.num) roleCode = undefined;
	}

	return {
		signedIn,
		isPublic,
		pinnedQuery,
		roleCode,
		permissionCode,

		currentAccountUpdates,
		signedInAccountMss,
		spaceMssAwaitingResponse,
	} satisfies CallerContext;
};
