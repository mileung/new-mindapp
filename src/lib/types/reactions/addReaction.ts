import { gsdb } from '$lib/global-state.svelte';
import { is1Emoji } from '$lib/js';
import { trpc } from '$lib/trpc/client';
import { and, or } from 'drizzle-orm';
import { type Database } from '../../local-db';
import {
	assert1Row,
	assertLt2Rows,
	channelPartsByCode,
	type PartInsert,
	type WhoObj,
} from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { getIdObj, getIdObjAsAtIdObj, id0, type IdObj } from '../parts/partIds';
import { pTable } from '../parts/partsTable';
import { moveTagCoreOrRxnCountsBy1 } from '../posts';

export let addReaction = async (
	input: WhoObj & {
		postIdObj: IdObj;
		emoji: string;
	},
	useLocalDb: boolean,
) => {
	if (!is1Emoji(input.emoji)) throw new Error(`Failed is1Emoji`);
	return useLocalDb //
		? _addReaction(await gsdb(), input, true)
		: trpc().addReaction.mutate(input);
};

export let _addReaction = async (
	db: Database,
	input: WhoObj & {
		postIdObj: IdObj;
		emoji: string;
	},
	useLocalDb: boolean,
) => {
	let rxnInMs = useLocalDb ? 0 : input.postIdObj.in_ms;
	let ms = Date.now();
	let reactionIdWithEmojiTxtAtPostIdObj: PartInsert = {
		...getIdObjAsAtIdObj(input.postIdObj),
		ms,
		by_ms: input.callerMs,
		in_ms: rxnInMs,
		code: pc.reactionIdWithEmojiTxtAtPostId,
		txt: input.emoji,
	};
	let partsToInsert: PartInsert[] = [reactionIdWithEmojiTxtAtPostIdObj];

	let {
		[pc.postIdLastVersionNumAtParentPostId]: postIdLastVersionNumAtParentPostIdRows = [],
		[pc.reactionIdWithEmojiTxtAtPostId]: reactionIdWithEmojiTxtAtPostIdRows = [],
		[pc.postIdRxnEmojiTxtAndCountNum]: postIdRxnEmojiTxtAndCountNumRows = [],
	} = channelPartsByCode(
		await db
			.select()
			.from(pTable)
			.where(
				or(
					and(
						pf.id(input.postIdObj),
						pf.code.eq(pc.postIdLastVersionNumAtParentPostId),
						pf.num.gte0,
						pf.txt.isNull,
					),
					and(
						pf.idAsAtId(input.postIdObj),
						pf.ms.gt0,
						pf.by_ms.eq(input.callerMs),
						pf.in_ms.eq(rxnInMs),
						pf.code.eq(pc.reactionIdWithEmojiTxtAtPostId),
						pf.num.isNull,
						pf.txt.eq(input.emoji),
					),
					and(
						pf.noAtId,
						pf.id(input.postIdObj),
						pf.code.eq(pc.postIdRxnEmojiTxtAndCountNum),
						pf.num.gt0,
						pf.txt.eq(input.emoji),
					),
				),
			),
	);
	if (reactionIdWithEmojiTxtAtPostIdRows.length) throw new Error(`Already added this reaction`);
	assert1Row(postIdLastVersionNumAtParentPostIdRows);
	assertLt2Rows(postIdRxnEmojiTxtAndCountNumRows)
		? await moveTagCoreOrRxnCountsBy1(
				db,
				[],
				[],
				[{ ...input.postIdObj, emoji: input.emoji }],
				true,
			)
		: partsToInsert.push({
				...id0,
				...getIdObj(input.postIdObj),
				code: pc.postIdRxnEmojiTxtAndCountNum,
				num: 1,
				txt: input.emoji,
			});

	console.log('partsToInsert', JSON.stringify(partsToInsert, null, 2));
	await db.insert(pTable).values(partsToInsert);
	return { ms };
};
