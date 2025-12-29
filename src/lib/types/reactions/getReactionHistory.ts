import type { Database } from '$lib/local-db';
import { trpc } from '$lib/trpc/client';
import { and, asc, desc } from 'drizzle-orm';
import type { Reaction, RxnEmoji } from '.';
import { gsdb } from '../../local-db';
import { getWhoWhereObj } from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { getIdObj, id0, type IdObj } from '../parts/partIds';
import { pTable } from '../parts/partsTable';

export let reactionsPerLoad = 88;

export let getReactionHistory = async (
	postIdObj: IdObj,
	fromMs: number,
	rxnIdObjsExclude: IdObj[],
) => {
	let baseInput = await getWhoWhereObj();
	return baseInput.spaceMs
		? trpc().getReactionHistory.query({
				...baseInput,
				postIdObj,
				fromMs,
				rxnIdObjsExclude,
			})
		: _getReactionHistory(await gsdb(), {
				...baseInput,
				postIdObj,
				fromMs,
				rxnIdObjsExclude,
			});
};

export let _getReactionHistory = async (
	db: Database,
	input: {
		postIdObj: IdObj;
		fromMs: number;
		rxnIdObjsExclude: IdObj[];
	},
) => {
	// console.table(await db.select().from(pTable));
	// console.log(await db.select().from(pTable));

	let reactionIdWithEmojiTxtAtPostIdRows = await db
		.select()
		.from(pTable)
		.where(
			and(
				pf.idAsAtId(input.postIdObj),
				and(...input.rxnIdObjsExclude.map((t) => pf.notId(t))),
				pf.code.eq(pc.reactionIdWithEmojiTxtAtPostId),
				pf.ms.lte(input.fromMs),
			),
		)
		.orderBy(desc(pTable.num), asc(pTable.txt))
		.limit(reactionsPerLoad);

	return {
		reactions: reactionIdWithEmojiTxtAtPostIdRows.map(
			(r) =>
				({
					...id0,
					...getIdObj(r),
					emoji: r.txt as RxnEmoji,
				}) satisfies Reaction,
		),
	};
};
