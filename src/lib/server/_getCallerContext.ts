import { hasDefinedKeysBesidesMs, ranStr } from '$lib/js';
import { tdb } from '$lib/server/db';
import { getValidAuthCookie, setCookie, type CookieObj } from '$lib/server/sessions';
import { hour, minute } from '$lib/time';
import type { Context } from '$lib/trpc/context';
import {
	reduceMyAccountUpdateRows,
	type CallerContext,
	type GetCallerContextGetArg,
	type MyAccountUpdates,
} from '$lib/types/accounts';
import {
	channelPartsByCode,
	sameGranularNum,
	type GranularNumProp,
	type PartSelect,
} from '$lib/types/parts';
import { pc } from '$lib/types/parts/partCodes';
import { pf } from '$lib/types/parts/partFilters';
import { id0 } from '$lib/types/parts/partIds';
import { pTable } from '$lib/types/parts/partsTable';
import {
	permissionCodes,
	reduceMySpaceUpdateRows,
	roleCodes,
	type MySpaceUpdate,
} from '$lib/types/spaces';
import { and, or } from 'drizzle-orm';

// export let getCallerContext = async (get: GetCallerContextGetArg) => {
// 	let baseInput = await getWhoWhereObj();
// 	// TODO: use local db as a fallback when cloud db can't find a post
// 	return baseInput.spaceMs
// 		? trpc().getCallerContext.query({ ...baseInput, get })
// 		: _getCallerContext(await gsdb(), null, baseInput, get);
// };

export let _getCallerContext = async (
	ctx: Context,
	{
		callerMs,
		spaceMs,
	}: {
		callerMs: number;
		spaceMs?: number;
	},
	get: GetCallerContextGetArg,
): Promise<CallerContext> => {
	// console.log('get:', get);
	// console.log('get', JSON.stringify(get, null, 2));
	if (!get.signedIn && (get.roleCode || get.permissionCode))
		throw new Error('must get signed in to get callerRole or permissionCode');
	if (
		(get.isPublic || get.roleCode || get.permissionCode) &&
		(spaceMs === undefined || spaceMs < 1)
	)
		throw new Error('spaceMs must be gt0');
	// if (!get.roleCode && get.permissionCode)
	// 	throw new Error('must get roleCode to get permissionCode');

	let ms = Date.now();
	let sessionIdObj = getValidAuthCookie(ctx, 'ms_sessionKey');

	let signedIn: undefined | boolean;
	let isPublic: undefined | GranularNumProp;
	let roleCode: undefined | GranularNumProp;
	let permissionCode: undefined | GranularNumProp;

	let {
		spaceUpdatesFrom = [], //
		signedInAccountUpdatesFrom = [],
	} = get;

	if (
		(get.signedIn || get.isPublic || get.roleCode || get.permissionCode) &&
		(spaceUpdatesFrom.length || signedInAccountUpdatesFrom.length)
	)
		throw new Error(
			`Cannot use get[signedIn/isPublic/roleCode/permissionCode] and spaceUpdatesFrom/signedInAccountUpdatesFrom at the same time`,
		);
	if (spaceMs && (get.isPublic || get.roleCode || get.permissionCode)) {
		if (get.isPublic) isPublic = { num: -1 };
		if (get.roleCode) roleCode = { num: -1 };
		if (get.permissionCode) permissionCode = { num: -1 };
		spaceUpdatesFrom.push({
			ms: spaceMs,
			isPublic,
			roleCode,
			permissionCode,
		});
	}

	if (sessionIdObj && callerMs && !signedInAccountUpdatesFrom.some((a) => a.ms === callerMs))
		signedInAccountUpdatesFrom.push({ ms: callerMs });
	signedInAccountUpdatesFrom = signedInAccountUpdatesFrom.filter((a) => a.ms);

	// Assume spaceUpdatesFrom and signedInAccountUpdatesFrom do not
	// have duplicate spaces/accounts otherwise garbage out

	// if ([new Set(spaceUpdatesFrom.map((s) => s.ms))].length !== spaceUpdatesFrom.length)
	// 	throw new Error(`duplicate spaces in spaceUpdatesFrom`);
	// if (
	// 	[new Set(signedInAccountUpdatesFrom.map((a) => a.ms))].length !==
	// 	signedInAccountUpdatesFrom.length
	// )
	// 	throw new Error(`duplicate accounts in signedInAccountUpdatesFrom`);

	let forcedSpaceUpdateRows: PartSelect[] = [];

	let filters = [
		...(sessionIdObj
			? [
					signedInAccountUpdatesFrom.length
						? and(
								or(...signedInAccountUpdatesFrom.map((a) => pf.atId({ at_ms: a.ms }))),
								pf.id({ ms: sessionIdObj.ms }),
								pf.code.eq(pc.sessionKeyTxtMs_ExpiryMs_AtAccountId),
								pf.num.gte0,
								pf.txt.eq(sessionIdObj.txt),
							)
						: undefined,
					callerMs && get.allJoinedSpaces
						? and(
								pf.atId({ at_ms: callerMs }),
								pf.ms.gt0,
								pf.in_ms.notEq(callerMs),
								...spaceUpdatesFrom.map((su) => pf.in_ms.notEq(su.ms)),
								pf.in_ms.gt0,
								or(
									pf.code.eq(pc.permissionCodeNumIdAtAccountId),
									pf.code.eq(pc.roleCodeNumIdAtAccountId),
									pf.code.eq(pc.spacePriorityIdAccentCodeNumAtAccountId),
								),
								pf.num.gte0,
								pf.txt.isNull,
							)
						: undefined,
				]
			: []),
		...spaceUpdatesFrom.flatMap((su) => {
			if (!su.ms || su.ms === callerMs) {
				su.isPublic &&
					su.isPublic.num !== 0 &&
					forcedSpaceUpdateRows.push({
						...id0,
						in_ms: su.ms,
						code: pc.spaceIsPublicBinId,
						num: 0,
						txt: null,
					});
				if (su.ms === spaceMs) {
					forcedSpaceUpdateRows.push({
						...id0,
						at_ms: callerMs,
						ms: callerMs,
						in_ms: callerMs,
						code: pc.permissionCodeNumIdAtAccountId,
						num: permissionCodes.reactAndPost,
						txt: null,
					});
					su.roleCode &&
						su.roleCode.num !== roleCodes.owner &&
						forcedSpaceUpdateRows.push({
							...id0,
							at_ms: callerMs,
							ms: callerMs,
							in_ms: callerMs,
							code: pc.roleCodeNumIdAtAccountId,
							num: roleCodes.owner,
							txt: null,
						});
				}
				// su.accentCode?.num &&
				// 	forcedSpaceUpdateRows.push({
				// 		...id0,
				// 		code: pc.spacePriorityIdAccentCodeNumAtAccountId,
				// 		num: accentCodes.none,
				// 		txt: null,
				// 	});
			}

			if (su.ms === 1 && su.isPublic && su.isPublic.num !== 1)
				forcedSpaceUpdateRows.push({
					...id0,
					in_ms: 1,
					code: pc.spaceIsPublicBinId,
					num: 1,
					txt: null,
				});
			return [
				su.ms && su.ms !== callerMs
					? su.accentCode &&
						and(
							pf.atId({ at_ms: callerMs }),
							pf.notGranularNum(su.accentCode),
							pf.in_ms.eq(su.ms),
							pf.code.eq(pc.spacePriorityIdAccentCodeNumAtAccountId),
							pf.num.gte0,
							pf.txt.isNull,
						)
					: undefined,
				su.ms === spaceMs && su.pinnedQuery
					? and(
							pf.noAtId,
							pf.notGranularTxt(su.pinnedQuery),
							pf.in_ms.eq(su.ms),
							pf.code.eq(pc.spacePinnedQueryTxtId),
							pf.num.eq0,
							pf.txt.isNotNull,
						)
					: undefined,
				...(su.ms && su.ms !== callerMs
					? [
							and(
								pf.atId({ at_ms: callerMs }),
								pf.ms.gt0,
								pf.in_ms.eq(su.ms),
								pf.code.eq(pc.permissionCodeNumIdAtAccountId),
								pf.num.gte0,
								pf.txt.isNull,
							),
							su.ms > 1 && su.name
								? and(
										pf.noAtId,
										pf.notGranularTxt(su.name),
										pf.in_ms.eq(su.ms),
										pf.code.eq(pc.spaceNameTxtId),
										pf.num.eq0,
										pf.txt.isNotNull,
									)
								: undefined,
							...(su.ms === spaceMs
								? [
										su.ms > 1 && su.isPublic
											? and(
													pf.noAtId,
													pf.notGranularNum(su.isPublic),
													pf.in_ms.eq(su.ms),
													pf.code.eq(pc.spaceIsPublicBinId),
													pf.num.gte0,
													pf.txt.isNull,
												)
											: undefined,
										su.roleCode
											? and(
													pf.atId({ at_ms: callerMs }),
													pf.notGranularNum(su.roleCode),
													pf.in_ms.eq(su.ms),
													pf.code.eq(pc.roleCodeNumIdAtAccountId),
													pf.num.gte0,
													pf.txt.isNull,
												)
											: undefined,
									]
								: []),
						]
					: []),
			];
		}),
		...signedInAccountUpdatesFrom.flatMap((signedInAccountUpdate) => {
			return [
				signedInAccountUpdate.email &&
					and(
						pf.noAtId,
						pf.notGranularTxt(signedInAccountUpdate.email),
						pf.by_ms.eq(signedInAccountUpdate.ms),
						pf.in_ms.eq0,
						pf.code.eq(pc.accountEmailTxtMsByMs),
						pf.num.eq0,
						pf.txt.isNotNull,
					),
				signedInAccountUpdate.name &&
					and(
						pf.noAtId,
						pf.notGranularTxt(signedInAccountUpdate.name),
						pf.by_ms.eq(signedInAccountUpdate.ms),
						pf.in_ms.eq0,
						pf.code.eq(pc.accountNameTxtMsByMs),
						pf.num.eq0,
						pf.txt.isNotNull,
					),
				signedInAccountUpdate.bio &&
					and(
						pf.noAtId,
						pf.notGranularTxt(signedInAccountUpdate.bio),
						pf.by_ms.eq(signedInAccountUpdate.ms),
						pf.in_ms.eq0,
						pf.code.eq(pc.accountBioTxtMsByMs),
						pf.num.eq0,
						pf.txt.isNotNull,
					),
				signedInAccountUpdate.savedTags &&
					and(
						pf.noAtId,
						pf.notGranularTxt(signedInAccountUpdate.savedTags),
						pf.by_ms.eq(signedInAccountUpdate.ms),
						pf.in_ms.eq0,
						pf.code.eq(pc.accountSavedTagsTxtMsByMs),
						pf.num.eq0,
						pf.txt.isNotNull,
					),
			];
		}),
	];

	let {
		[pc.sessionKeyTxtMs_ExpiryMs_AtAccountId]: sessionKeyTxtMs_ExpiryMs_AtAccountIdRows = [],

		[pc.spaceIsPublicBinId]: spaceIsPublicBinIdRows = [],
		[pc.spaceNameTxtId]: spaceNameTxtIdRows = [],
		[pc.spacePinnedQueryTxtId]: spacePinnedQueryTxtIdRows = [],
		[pc.roleCodeNumIdAtAccountId]: roleCodeNumIdAtAccountIdRows = [],
		[pc.permissionCodeNumIdAtAccountId]: permissionCodeNumIdAtAccountIdRows = [],
		[pc.spacePriorityIdAccentCodeNumAtAccountId]: spacePriorityIdAccentCodeNumAtAccountIdRows = [],

		[pc.accountEmailTxtMsByMs]: accountEmailTxtMsByMsRows = [],
		[pc.accountNameTxtMsByMs]: accountNameTxtMsByMsRows = [],
		[pc.accountBioTxtMsByMs]: accountBioTxtMsByMsRows = [],
		[pc.accountSavedTagsTxtMsByMs]: accountSavedTagsTxtMsByMsRows = [],
	} = channelPartsByCode([
		...(filters.some((f) => f)
			? await tdb
					.select()
					.from(pTable)
					.where(or(...filters))
			: []),
		...forcedSpaceUpdateRows,
	]);

	if (
		roleCodeNumIdAtAccountIdRows.some(
			({ num }) =>
				num !== roleCodes.member &&
				num !== roleCodes.mod && //
				num !== roleCodes.owner,
		)
	)
		throw new Error(`invalid roleCode num`);
	if (
		permissionCodeNumIdAtAccountIdRows.some(
			({ num }) =>
				num !== permissionCodes.viewOnly &&
				num !== permissionCodes.reactOnly &&
				num !== permissionCodes.postOnly &&
				num !== permissionCodes.reactAndPost,
		)
	)
		throw new Error(`invalid permissionCode num`);

	let caller_sessionKeyTxtMs_ExpiryMs_AtAccountIdRow =
		sessionKeyTxtMs_ExpiryMs_AtAccountIdRows.find((row) => row.at_ms === callerMs);

	let msToSpaceUpdatesFrom: Record<number, undefined | MySpaceUpdate> = {};
	for (let i = 0; i < spaceUpdatesFrom.length; i++) {
		let u = spaceUpdatesFrom[i];
		msToSpaceUpdatesFrom[u.ms] = u;
	}
	if (get.allJoinedSpaces && caller_sessionKeyTxtMs_ExpiryMs_AtAccountIdRow) {
		let unfetchedSpaceMss: number[] = [];
		for (let i = 0; i < permissionCodeNumIdAtAccountIdRows.length; i++) {
			let row = permissionCodeNumIdAtAccountIdRows[i];
			if (!msToSpaceUpdatesFrom[row.in_ms]) unfetchedSpaceMss.push(row.in_ms);
		}
		if (unfetchedSpaceMss.length) {
			let {
				[pc.spaceIsPublicBinId]: _spaceIsPublicBinIdRows = [],
				[pc.spaceNameTxtId]: _spaceNameTxtIdRows = [],
				[pc.spacePinnedQueryTxtId]: _spacePinnedQueryTxtIdRows = [],
			} = channelPartsByCode(
				await tdb
					.select()
					.from(pTable)
					.where(
						and(
							pf.noAtId,
							or(...unfetchedSpaceMss.map((ms) => pf.in_ms.eq(ms))),
							or(
								and(
									pf.code.eq(pc.spaceIsPublicBinId),
									pf.num.gte0, //
									pf.num.lte(1),
									pf.txt.isNull,
								),
								and(
									or(
										pf.code.eq(pc.spaceNameTxtId), //
										pf.code.eq(pc.spacePinnedQueryTxtId),
									),
									pf.num.eq0, //
									pf.txt.isNotNull,
								),
							),
						),
					),
			);
			spaceIsPublicBinIdRows.push(..._spaceIsPublicBinIdRows);
			spaceNameTxtIdRows.push(..._spaceNameTxtIdRows);
			spacePinnedQueryTxtIdRows.push(..._spacePinnedQueryTxtIdRows);
		}
	}

	let spaceUpdatedRows = [
		...spaceIsPublicBinIdRows,
		...spaceNameTxtIdRows,
		...spacePinnedQueryTxtIdRows,
		...permissionCodeNumIdAtAccountIdRows,
		...roleCodeNumIdAtAccountIdRows,
		...spacePriorityIdAccentCodeNumAtAccountIdRows,
	];
	let spaceMsToRowsMap: Record<number, PartSelect[]> = {};
	for (let i = 0; i < spaceUpdatedRows.length; i++) {
		let row = spaceUpdatedRows[i];
		spaceMsToRowsMap[row.in_ms] ??= [];
		spaceMsToRowsMap[row.in_ms].push(row);
	}
	let SpaceMssWithPermission = caller_sessionKeyTxtMs_ExpiryMs_AtAccountIdRow
		? permissionCodeNumIdAtAccountIdRows.map((r) => r.in_ms)
		: [];
	let callerJoinedSpaceMs = false;
	let spaceUpdates: MySpaceUpdate[] = SpaceMssWithPermission.map((ms) => {
		if (ms === spaceMs) callerJoinedSpaceMs = true;
		let su = reduceMySpaceUpdateRows(spaceMsToRowsMap[ms] || [{ in_ms: ms }]);
		let spaceUpdateFrom = msToSpaceUpdatesFrom[ms];
		// Need this if statement since permissionCode doesn't use notGranularNum
		if (
			!spaceUpdateFrom?.permissionCode ||
			su.ms === callerMs ||
			sameGranularNum(su.permissionCode, spaceUpdateFrom?.permissionCode)
		)
			su.permissionCode = undefined;
		return su;
	});
	let visitingPublicSpaceUpdate: undefined | MySpaceUpdate =
		spaceMs !== undefined &&
		!callerJoinedSpaceMs &&
		spaceIsPublicBinIdRows.some((r) => r.in_ms === spaceMs)
			? reduceMySpaceUpdateRows(spaceMsToRowsMap[spaceMs] || [{ in_ms: spaceMs }])
			: undefined;

	if (visitingPublicSpaceUpdate) {
		let spaceUpdateFrom = msToSpaceUpdatesFrom[visitingPublicSpaceUpdate.ms];
		if (!visitingPublicSpaceUpdate.isPublic?.num) {
			visitingPublicSpaceUpdate = undefined;
		} else {
			if (sameGranularNum(visitingPublicSpaceUpdate.isPublic, spaceUpdateFrom?.isPublic))
				visitingPublicSpaceUpdate.isPublic = undefined;
			if (!hasDefinedKeysBesidesMs(visitingPublicSpaceUpdate))
				visitingPublicSpaceUpdate = undefined;
		}
	}

	let accountUpdatedRows = [
		...accountEmailTxtMsByMsRows,
		...accountNameTxtMsByMsRows,
		...accountBioTxtMsByMsRows,
		...accountSavedTagsTxtMsByMsRows,
	];
	let accountMsToRowsMap: Record<number, PartSelect[]> = {};
	for (let i = 0; i < accountUpdatedRows.length; i++) {
		let row = accountUpdatedRows[i];
		accountMsToRowsMap[row.by_ms] ??= [];
		accountMsToRowsMap[row.by_ms].push(row);
	}
	let signedInAccountUpdates: MyAccountUpdates[] = sessionKeyTxtMs_ExpiryMs_AtAccountIdRows.map(
		({ at_ms }) => reduceMyAccountUpdateRows(accountMsToRowsMap[at_ms] || [{ by_ms: at_ms }]),
	);

	if (caller_sessionKeyTxtMs_ExpiryMs_AtAccountIdRow) {
		if (get.signedIn) {
			signedIn = true;
			if (get.roleCode) {
				if (spaceMs === callerMs) roleCode = { num: roleCodes.owner };
				else {
					let caller_roleCodeNumIdAtAccountIdRow = roleCodeNumIdAtAccountIdRows.find(
						(row) => row.at_ms === callerMs,
					);
					if (caller_roleCodeNumIdAtAccountIdRow) {
						let { ms, num } = caller_roleCodeNumIdAtAccountIdRow;
						roleCode = { ms, num };
					} else roleCode = undefined;
				}
			}
			if (get.permissionCode) {
				if (spaceMs === callerMs) {
					permissionCode = { num: permissionCodes.reactAndPost };
				} else {
					let caller_permissionCodeNumIdAtAccountIdRow = permissionCodeNumIdAtAccountIdRows.find(
						(row) => row.at_ms === callerMs,
					);
					if (caller_permissionCodeNumIdAtAccountIdRow) {
						let { ms, num } = caller_permissionCodeNumIdAtAccountIdRow;
						permissionCode = { ms, num };
					} else permissionCode = undefined;
				}
			}
		}
		if (ms - caller_sessionKeyTxtMs_ExpiryMs_AtAccountIdRow.ms > hour) {
			let newSessionObj: CookieObj = { ms, txt: ranStr() };
			setCookie(ctx, 'ms_sessionKey', newSessionObj);
			await tdb.insert(pTable).values({
				...id0,
				at_ms: callerMs,
				code: pc.sessionKeyTxtMs_ExpiryMs_AtAccountId,
				num: 0,
				...newSessionObj,
			});
			if (!caller_sessionKeyTxtMs_ExpiryMs_AtAccountIdRow.num) {
				let oldCookiePartialFilter = [
					pf.at_by_ms.eq0,
					pf.at_in_ms.eq0,
					pf.ms.eq(caller_sessionKeyTxtMs_ExpiryMs_AtAccountIdRow.ms),
					pf.in_ms.eq0,
					pf.code.eq(pc.sessionKeyTxtMs_ExpiryMs_AtAccountId),
					pf.num.eq0,
					pf.txt.eq(caller_sessionKeyTxtMs_ExpiryMs_AtAccountIdRow.txt!),
				];
				await tdb
					.update(pTable)
					.set({ num: ms + minute })
					.where(
						and(
							pf.at_ms.eq(callerMs), //
							...oldCookiePartialFilter,
						),
					);
				await tdb
					.update(pTable)
					.set(newSessionObj)
					.where(
						and(
							pf.at_ms.gt0, //
							pf.at_ms.notEq(callerMs),
							...oldCookiePartialFilter,
						),
					);
			}
		}
	} else if (callerMs) {
		spaceUpdates = [];
	}

	if (get.isPublic) {
		if (spaceMs === 1) isPublic = { num: 1 };
		else {
			let caller_spaceIsPublicBinIdRow = spaceIsPublicBinIdRows.find(
				(row) => row.in_ms === spaceMs,
			);
			if (caller_spaceIsPublicBinIdRow) {
				let { ms, num } = caller_spaceIsPublicBinIdRow;
				isPublic = permissionCode || num ? { ms, num } : undefined;
			} else isPublic = undefined;
		}
	}

	let removedSpaceMss: number[] = spaceUpdatesFrom
		.filter((su) => su.ms && !su.visiting && !SpaceMssWithPermission.includes(su.ms))
		.map((su) => su.ms);
	let signedOutAccountMss: number[] = signedInAccountUpdatesFrom
		.filter(
			(accountFrom) =>
				!sessionIdObj ||
				!signedInAccountUpdates.some((accountUpdate) => accountUpdate.ms === accountFrom.ms),
		)
		.map((su) => su.ms);
	spaceUpdates = spaceUpdates.filter((s) => hasDefinedKeysBesidesMs(s));
	signedInAccountUpdates = signedInAccountUpdates.filter((s) => hasDefinedKeysBesidesMs(s));

	return {
		signedIn,
		roleCode,
		permissionCode,
		isPublic,

		visitingPublicSpaceUpdate,
		removedSpaceMss: removedSpaceMss.length ? removedSpaceMss : undefined,
		signedOutAccountMss: signedOutAccountMss.length ? signedOutAccountMss : undefined,
		spaceUpdates: spaceUpdates.length ? spaceUpdates : undefined,
		signedInAccountUpdates: signedInAccountUpdates.length ? signedInAccountUpdates : undefined,
	};
};
