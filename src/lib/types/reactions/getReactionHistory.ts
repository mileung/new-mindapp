import { getWhoWhereObj, gsdb } from '$lib/global-state.svelte';
import type { Database } from '$lib/local-db';
import { trpc } from '$lib/trpc/client';
import { and, asc, desc } from 'drizzle-orm';
import type { Reaction, RxnEmoji } from '.';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { getIdObj, id0, type IdObj } from '../parts/partIds';
import { pTable } from '../parts/partsTable';

export let reactionsPerLoad = 88;

export let getReactionHistory = async ({
	postIdObj,
	msBefore,
	rxnIdObjsExclude,
}: {
	postIdObj: IdObj;
	msBefore: number;
	rxnIdObjsExclude: IdObj[];
}) => {
	let baseInput = await getWhoWhereObj();
	postIdObj = getIdObj(postIdObj);
	return baseInput.spaceMs
		? trpc().getReactionHistory.query({
				...baseInput,
				postIdObj,
				msBefore,
				rxnIdObjsExclude,
			})
		: _getReactionHistory(await gsdb(), {
				...baseInput,
				postIdObj,
				msBefore,
				rxnIdObjsExclude,
			});
};

export let _getReactionHistory = async (
	db: Database,
	input: {
		postIdObj: IdObj;
		msBefore: number;
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
				// pf.ms.lte(input.fromMs),
				// TODO: pf.ms.lt(input.msBefore),
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
