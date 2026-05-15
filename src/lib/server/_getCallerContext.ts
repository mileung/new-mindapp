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
	let inGlobal: undefined | boolean;

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
		spaceUpdatesFrom.push({
			ms: spaceMs,
			isPublic: get.isPublic ? { num: -1 } : undefined,
			roleCode: get.roleCode ? { num: -1 } : undefined,
			permissionCode: get.permissionCode ? { num: -1 } : undefined,
		});
	}
	if (get.inGlobal) spaceUpdatesFrom.push({ ms: 1 });

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
								pf.code.eq(pc.ms_ExpiryMs__accountMs__sessionKey),
								pf.num.isNull,
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
									pf.code.eq(pc.id__accountMs_permissionCode),
									pf.code.eq(pc.id__accountMs_roleCode),
									pf.code.eq(pc.spacePriorityId__accountMs_accentCode),
								),
								pf.num.gte0,
								pf.txt.isNull,
							)
						: undefined,
				]
			: []),
		...spaceUpdatesFrom.flatMap((su) => {
			if (!su.ms) throw new Error(`cannot get updates from local space`);
			if (su.ms === callerMs) {
				su.isPublic &&
					su.isPublic.num !== 0 &&
					forcedSpaceUpdateRows.push({
						...id0,
						in_ms: su.ms,
						code: pc.id_spaceIsPublic,
						num: 0,
						txt: null,
					});
				if (su.ms === spaceMs) {
					forcedSpaceUpdateRows.push({
						...id0,
						at_ms: callerMs,
						ms: callerMs,
						in_ms: callerMs,
						code: pc.id__accountMs_permissionCode,
						num: permissionCodes.reactAndPost,
						txt: null,
					});
					su.roleCode &&
						su.roleCode.num !== roleCodes.admin &&
						forcedSpaceUpdateRows.push({
							...id0,
							at_ms: callerMs,
							ms: callerMs,
							in_ms: callerMs,
							code: pc.id__accountMs_roleCode,
							num: roleCodes.admin,
							txt: null,
						});
				}
				// su.accentCode?.num &&
				// 	forcedSpaceUpdateRows.push({
				// 		...id0,
				// 		code: pc.spacePriorityId__accountMs_accentCode,
				// 		num: accentCodes.none,
				// 		txt: null,
				// 	});
			}

			if (su.ms === 1 && su.isPublic && su.isPublic.num !== 1)
				forcedSpaceUpdateRows.push({
					...id0,
					in_ms: 1,
					code: pc.id_spaceIsPublic,
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
							pf.code.eq(pc.spacePriorityId__accountMs_accentCode),
							pf.num.gte0,
							pf.txt.isNull,
						)
					: undefined,
				su.ms === spaceMs && su.pinnedQuery
					? and(
							pf.noAtId,
							pf.notGranularTxt(su.pinnedQuery),
							pf.in_ms.eq(su.ms),
							pf.code.eq(pc.id__spacePinnedQuery),
							pf.num.isNull,
							pf.txt.isNotNull,
						)
					: undefined,
				...(su.ms && su.ms !== callerMs
					? [
							and(
								pf.atId({ at_ms: callerMs }),
								pf.ms.gt0,
								pf.in_ms.eq(su.ms),
								pf.code.eq(pc.id__accountMs_permissionCode),
								pf.num.gte0,
								pf.txt.isNull,
							),
							su.ms > 1 && su.name
								? and(
										pf.noAtId,
										pf.notGranularTxt(su.name),
										pf.in_ms.eq(su.ms),
										pf.code.eq(pc.id__spaceName),
										pf.num.isNull,
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
													pf.code.eq(pc.id_spaceIsPublic),
													pf.num.gte0,
													pf.txt.isNull,
												)
											: undefined,
										su.roleCode
											? and(
													pf.atId({ at_ms: callerMs }),
													pf.notGranularNum(su.roleCode),
													pf.in_ms.eq(su.ms),
													pf.code.eq(pc.id__accountMs_roleCode),
													pf.num.gte0,
													pf.txt.isNull,
												)
											: undefined,
										su.flair
											? and(
													pf.atId({ at_ms: callerMs }),
													pf.notGranularTxt(su.flair),
													pf.in_ms.eq(su.ms),
													pf.code.eq(pc.id__accountMs__flair),
													pf.num.isNull,
													pf.txt.isNotNull,
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
						pf.code.eq(pc.msByMs__accountEmail),
						pf.num.isNull,
						pf.txt.isNotNull,
					),
				signedInAccountUpdate.name &&
					and(
						pf.noAtId,
						pf.notGranularTxt(signedInAccountUpdate.name),
						pf.by_ms.eq(signedInAccountUpdate.ms),
						pf.in_ms.eq0,
						pf.code.eq(pc.msByMs__accountName),
						pf.num.isNull,
						pf.txt.isNotNull,
					),
				signedInAccountUpdate.bio &&
					and(
						pf.noAtId,
						pf.notGranularTxt(signedInAccountUpdate.bio),
						pf.by_ms.eq(signedInAccountUpdate.ms),
						pf.in_ms.eq0,
						pf.code.eq(pc.msByMs__accountBio),
						pf.num.isNull,
						pf.txt.isNotNull,
					),
				signedInAccountUpdate.savedTags &&
					and(
						pf.noAtId,
						pf.notGranularTxt(signedInAccountUpdate.savedTags),
						pf.by_ms.eq(signedInAccountUpdate.ms),
						pf.in_ms.eq0,
						pf.code.eq(pc.msByMs__accountSavedTags),
						pf.num.isNull,
						pf.txt.isNotNull,
					),
			];
		}),
	];

	let {
		[pc.ms_ExpiryMs__accountMs__sessionKey]: ms_ExpiryMs__accountMs__sessionKeyRows = [],

		[pc.id_spaceIsPublic]: id_spaceIsPublicRows = [],
		[pc.id__spaceName]: id__spaceNameRows = [],
		[pc.id__spacePinnedQuery]: id__spacePinnedQueryRows = [],
		[pc.id__accountMs_roleCode]: id__accountMs_roleCodeRows = [],
		[pc.id__accountMs_permissionCode]: id__accountMs_permissionCodeRows = [],
		[pc.id__accountMs__flair]: id__accountMs__flairRows = [],
		[pc.spacePriorityId__accountMs_accentCode]: spacePriorityId__accountMs_accentCodeRows = [],

		[pc.msByMs__accountEmail]: msByMs__accountEmailRows = [],
		[pc.msByMs__accountName]: msByMs__accountNameRows = [],
		[pc.msByMs__accountBio]: msByMs__accountBioRows = [],
		[pc.msByMs__accountSavedTags]: msByMs__accountSavedTagsRows = [],
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
		id__accountMs_roleCodeRows.some(
			({ num }) =>
				num !== roleCodes.member &&
				num !== roleCodes.mod && //
				num !== roleCodes.admin,
		)
	)
		throw new Error(`invalid roleCode num`);
	if (
		id__accountMs_permissionCodeRows.some(
			({ num }) =>
				num !== permissionCodes.viewOnly &&
				num !== permissionCodes.reactOnly &&
				num !== permissionCodes.postOnly &&
				num !== permissionCodes.reactAndPost,
		)
	)
		throw new Error(`invalid permissionCode num`);

	let caller_ms_ExpiryMs__accountMs__sessionKeyRow = ms_ExpiryMs__accountMs__sessionKeyRows.find(
		(row) => row.at_ms === callerMs,
	);

	let msToSpaceUpdatesFrom: Record<number, undefined | MySpaceUpdate> = {};
	for (let i = 0; i < spaceUpdatesFrom.length; i++) {
		let u = spaceUpdatesFrom[i];
		msToSpaceUpdatesFrom[u.ms] = u;
	}
	if (get.allJoinedSpaces && caller_ms_ExpiryMs__accountMs__sessionKeyRow) {
		let unfetchedSpaceMss: number[] = [];
		for (let i = 0; i < id__accountMs_permissionCodeRows.length; i++) {
			let row = id__accountMs_permissionCodeRows[i];
			if (!msToSpaceUpdatesFrom[row.in_ms]) unfetchedSpaceMss.push(row.in_ms);
		}
		if (unfetchedSpaceMss.length) {
			let {
				[pc.id_spaceIsPublic]: _id_spaceIsPublicRows = [],
				[pc.id__spaceName]: _id__spaceNameRows = [],
				[pc.id__spacePinnedQuery]: _id__spacePinnedQueryRows = [],
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
									pf.code.eq(pc.id_spaceIsPublic),
									pf.num.gte0, //
									pf.num.lte(1),
									pf.txt.isNull,
								),
								and(
									or(
										pf.code.eq(pc.id__spaceName), //
										pf.code.eq(pc.id__spacePinnedQuery),
									),
									pf.num.isNull,
									pf.txt.isNotNull,
								),
							),
						),
					),
			);
			id_spaceIsPublicRows.push(..._id_spaceIsPublicRows);
			id__spaceNameRows.push(..._id__spaceNameRows);
			id__spacePinnedQueryRows.push(..._id__spacePinnedQueryRows);
		}
	}

	let spaceUpdatedRows = [
		...id_spaceIsPublicRows,
		...id__spaceNameRows,
		...id__spacePinnedQueryRows,
		...id__accountMs_permissionCodeRows,
		...id__accountMs_roleCodeRows,
		...id__accountMs__flairRows,
		...spacePriorityId__accountMs_accentCodeRows,
	];
	let spaceMsToRowsMap: Record<number, PartSelect[]> = {};
	for (let i = 0; i < spaceUpdatedRows.length; i++) {
		let row = spaceUpdatedRows[i];
		spaceMsToRowsMap[row.in_ms] ??= [];
		spaceMsToRowsMap[row.in_ms].push(row);
	}
	let SpaceMssWithPermission = caller_ms_ExpiryMs__accountMs__sessionKeyRow
		? id__accountMs_permissionCodeRows.map((r) => r.in_ms)
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
		id_spaceIsPublicRows.some((r) => r.in_ms === spaceMs && r.num)
			? reduceMySpaceUpdateRows(spaceMsToRowsMap[spaceMs])
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
		...msByMs__accountEmailRows,
		...msByMs__accountNameRows,
		...msByMs__accountBioRows,
		...msByMs__accountSavedTagsRows,
	];
	let accountMsToRowsMap: Record<number, PartSelect[]> = {};
	for (let i = 0; i < accountUpdatedRows.length; i++) {
		let row = accountUpdatedRows[i];
		accountMsToRowsMap[row.by_ms] ??= [];
		accountMsToRowsMap[row.by_ms].push(row);
	}
	let signedInAccountUpdates: MyAccountUpdates[] = ms_ExpiryMs__accountMs__sessionKeyRows.map(
		({ at_ms }) => reduceMyAccountUpdateRows(accountMsToRowsMap[at_ms] || [{ by_ms: at_ms }]),
	);

	if (caller_ms_ExpiryMs__accountMs__sessionKeyRow) {
		if (get.signedIn) {
			signedIn = true;
			if (get.roleCode) {
				if (spaceMs === callerMs) roleCode = { num: roleCodes.admin };
				else {
					let id__accountMs_roleCodeRowInCallerSpace = id__accountMs_roleCodeRows.find(
						(row) => row.in_ms === spaceMs && row.at_ms === callerMs,
					);
					if (id__accountMs_roleCodeRowInCallerSpace) {
						let { ms, num } = id__accountMs_roleCodeRowInCallerSpace;
						roleCode = { ms, num: num! };
					}
				}
			}
			if (get.permissionCode) {
				if (spaceMs === callerMs) {
					permissionCode = { num: permissionCodes.reactAndPost };
				} else {
					let id__accountMs_permissionCodeRowInCallerSpace = id__accountMs_permissionCodeRows.find(
						(row) => row.in_ms === spaceMs && row.at_ms === callerMs,
					);
					if (id__accountMs_permissionCodeRowInCallerSpace) {
						let { ms, num } = id__accountMs_permissionCodeRowInCallerSpace;
						permissionCode = { ms, num: num! };
					}
				}
			}
			if (get.inGlobal) {
				inGlobal = id__accountMs_permissionCodeRows.some(
					(row) => row.in_ms === 1 && row.at_ms === callerMs,
				);
			}
		}
		if (ms - caller_ms_ExpiryMs__accountMs__sessionKeyRow.ms > hour) {
			let newSessionObj: CookieObj = { ms, txt: ranStr() };
			setCookie(ctx, 'ms_sessionKey', newSessionObj);
			await tdb.insert(pTable).values({
				...id0,
				at_ms: callerMs,
				code: pc.ms_ExpiryMs__accountMs__sessionKey,
				...newSessionObj,
			});
			if (!caller_ms_ExpiryMs__accountMs__sessionKeyRow.num) {
				let oldCookiePartialFilter = [
					pf.at_by_ms.eq0,
					pf.at_in_ms.eq0,
					pf.ms.eq(caller_ms_ExpiryMs__accountMs__sessionKeyRow.ms),
					pf.in_ms.eq0,
					pf.code.eq(pc.ms_ExpiryMs__accountMs__sessionKey),
					pf.num.isNull,
					pf.txt.eq(caller_ms_ExpiryMs__accountMs__sessionKeyRow.txt!),
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
		else if (spaceMs === callerMs) isPublic = { num: 0 };
		else {
			let id_spaceIsPublicRowInCallerSpace = id_spaceIsPublicRows.find(
				(row) => row.in_ms === spaceMs,
			);
			if (id_spaceIsPublicRowInCallerSpace) {
				let { ms, num } = id_spaceIsPublicRowInCallerSpace;
				isPublic = permissionCode || num ? { ms, num: num! } : undefined;
			}
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
		inGlobal,

		visitingPublicSpaceUpdate,
		removedSpaceMss: removedSpaceMss.length ? removedSpaceMss : undefined,
		signedOutAccountMss: signedOutAccountMss.length ? signedOutAccountMss : undefined,
		spaceUpdates: spaceUpdates.length ? spaceUpdates : undefined,
		signedInAccountUpdates: signedInAccountUpdates.length ? signedInAccountUpdates : undefined,
	};
};
