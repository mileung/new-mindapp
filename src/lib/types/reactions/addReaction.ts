import { trpc } from '$lib/trpc/client';
import { and, or } from 'drizzle-orm';
import { ReactionSchema, type Reaction } from '.';
import { gsdb, type Database } from '../../local-db';
import { assert1Row, assertLt2Rows, channelPartsByCode, type PartInsert } from '../parts';
import { pc } from '../parts/partCodes';
import { pt } from '../parts/partFilters';
import { getFullIdObj } from '../parts/partIds';
import { pTable } from '../parts/partsTable';
import { moveTagCoreOrRxnCountsBy1 } from '../posts';

export let addReaction = async (rxn: Reaction, useRpc: boolean) => {
	if (!ReactionSchema.safeParse(rxn).success) throw new Error(`Invalid post`);
	return useRpc
		? trpc().addReaction.mutate(rxn) //
		: _addReaction(await gsdb(), rxn);
};

export let _addReaction = async (db: Database, rxn: Reaction) => {
	let ms = Date.now();
	let reactionIdWithEmojiTxtAtPostIdObj: PartInsert = {
		...getFullIdObj(rxn),
		ms,
		code: pc.reactionIdWithEmojiTxtAtPostId,
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
		[pc.postIdWithNumAsLastVersionAtParentPostId]: parentPostIdWNumAsLastVersionAtPPostIdObj = [],
		[pc.reactionIdWithEmojiTxtAtPostId]: reactionIdWithEmojiTxtAtPostIdObjs = [],
	} = channelPartsByCode(
		await db
			.select()
			.from(pTable)
			.where(
				or(
					and(
						pt.atIdAsId(reactionIdWithEmojiTxtAtPostIdObj),
						pt.code.eq(pc.postIdWithNumAsLastVersionAtParentPostId),
						pt.txt.isNull,
						pt.num.isNotNull,
					),
					and(
						pt.atId(reactionIdWithEmojiTxtAtPostIdObj),
						pt.code.eq(pc.reactionIdWithEmojiTxtAtPostId),
						pt.txt.eq(rxn.emoji),
						pt.num.isNotNull,
					),
				),
			),
	);
	if (reactionIdWithEmojiTxtAtPostIdObjs.length) throw new Error(`Already added this reaction`);
	assert1Row(parentPostIdWNumAsLastVersionAtPPostIdObj);
	let reactionEmojiTxtWithUniqueMsAndNumAsCountAtPostIdObj = assertLt2Rows(
		await db
			.select()
			.from(pTable)
			.where(
				and(
					pt.atId(reactionIdWithEmojiTxtAtPostIdObj),
					pt.code.eq(pc.reactionEmojiTxtWithUniqueMsAndNumAsCountAtPostId),
					pt.txt.eq(rxn.emoji),
					pt.num.isNotNull,
				),
			),
	);
	if (reactionEmojiTxtWithUniqueMsAndNumAsCountAtPostIdObj) {
		await moveTagCoreOrRxnCountsBy1(db, [], [], [{ ...rxn, ms }], true);
	} else {
		partsToInsert.push({
			...reactionIdWithEmojiTxtAtPostIdObj,
			code: pc.reactionEmojiTxtWithUniqueMsAndNumAsCountAtPostId,
			txt: rxn.emoji,
			num: 1,
		});
	}
	await db.insert(pTable).values(partsToInsert);
	return { ms };
};
