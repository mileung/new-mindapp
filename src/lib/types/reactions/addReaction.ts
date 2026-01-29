import { trpc } from '$lib/trpc/client';
import { and, or } from 'drizzle-orm';
import { ReactionSchema, type Reaction } from '.';
import { gsdb, type Database } from '../../local-db';
import {
	assert1Row,
	assertLt2Rows,
	channelPartsByCode,
	getWhoWhereObj,
	type PartInsert,
} from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { getFullIdObj } from '../parts/partIds';
import { pTable } from '../parts/partsTable';
import { moveTagCoreOrRxnCountsBy1 } from '../posts';

export let addReaction = async (rxn: Reaction, useRpc: boolean) => {
	if (!ReactionSchema.safeParse(rxn).success) throw new Error(`Invalid post`);
	return useRpc
		? trpc().addReaction.mutate({ ...(await getWhoWhereObj()), rxn }) //
		: _addReaction(await gsdb(), rxn);
};

export let _addReaction = async (db: Database, rxn: Reaction) => {
	let ms = Date.now();
	let reactionIdWithEmojiTxtAtPostIdObj: PartInsert = {
		...getFullIdObj(rxn),
		ms,
		code: pc.reactionIdWithEmojiTxtAtPostId,
		num: 0,
		txt: rxn.emoji,
	};
	let partsToInsert: PartInsert[] = [
		reactionIdWithEmojiTxtAtPostIdObj,
		// TODO: bump posts if it gets a certain number of rxns?
		// {
		// 	...atPostIdObj,
		// 	...postIdObj,
		// 	code: pc.postIdAtBumpedRootId,
		// },
	];

	let {
		[pc.postIdWithNumAsLastVersionAtParentPostId]: parentPostIdWNumAsLastVersionAtPPostIdRows = [],
		[pc.reactionIdWithEmojiTxtAtPostId]: reactionIdWithEmojiTxtAtPostIdRows = [],
	} = channelPartsByCode(
		await db
			.select()
			.from(pTable)
			.where(
				or(
					and(
						pf.atIdAsId(reactionIdWithEmojiTxtAtPostIdObj),
						pf.code.eq(pc.postIdWithNumAsLastVersionAtParentPostId),
						pf.num.gte0,
						pf.txt.isNull,
					),
					and(
						pf.atId(reactionIdWithEmojiTxtAtPostIdObj),
						pf.code.eq(pc.reactionIdWithEmojiTxtAtPostId),
						pf.num.gte0,
						pf.txt.eq(rxn.emoji),
					),
				),
			),
	);
	if (reactionIdWithEmojiTxtAtPostIdRows.length) throw new Error(`Already added this reaction`);
	assert1Row(parentPostIdWNumAsLastVersionAtPPostIdRows);
	let reactionEmojiTxtWithUniqueMsAndNumAsCountAtPostIdRow = assertLt2Rows(
		await db
			.select()
			.from(pTable)
			.where(
				and(
					pf.atId(reactionIdWithEmojiTxtAtPostIdObj),
					pf.code.eq(pc.reactionEmojiTxtWithUniqueMsAndNumAsCountAtPostId),
					pf.num.gte0,
					pf.txt.eq(rxn.emoji),
				),
			),
	);
	if (reactionEmojiTxtWithUniqueMsAndNumAsCountAtPostIdRow) {
		await moveTagCoreOrRxnCountsBy1(db, [], [], [{ ...rxn, ms }], true);
	} else {
		partsToInsert.push({
			...reactionIdWithEmojiTxtAtPostIdObj,
			code: pc.reactionEmojiTxtWithUniqueMsAndNumAsCountAtPostId,
			num: 1,
			txt: rxn.emoji,
		});
	}
	await db.insert(pTable).values(partsToInsert);
	return { ms };
};
