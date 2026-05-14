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
	let reactionId__postId__emojiObj: PartInsert = {
		...getIdObjAsAtIdObj(input.postIdObj),
		ms,
		by_ms: input.callerMs,
		in_ms: rxnInMs,
		code: pc.reactionId__postId__emoji,
		txt: input.emoji,
	};
	let partsToInsert: PartInsert[] = [reactionId__postId__emojiObj];

	let {
		[pc.postId__parentPostId_lastVersion]: postId__parentPostId_lastVersionRows = [],
		[pc.reactionId__postId__emoji]: reactionId__postId__emojiRows = [],
		[pc.postId_count_emoji]: postId_count_emojiRows = [],
	} = channelPartsByCode(
		await db
			.select()
			.from(pTable)
			.where(
				or(
					and(
						pf.id(input.postIdObj),
						pf.code.eq(pc.postId__parentPostId_lastVersion),
						pf.num.gte0,
						pf.txt.isNull,
					),
					and(
						pf.idAsAtId(input.postIdObj),
						pf.ms.gt0,
						pf.by_ms.eq(input.callerMs),
						pf.in_ms.eq(rxnInMs),
						pf.code.eq(pc.reactionId__postId__emoji),
						pf.num.isNull,
						pf.txt.eq(input.emoji),
					),
					and(
						pf.noAtId,
						pf.id(input.postIdObj),
						pf.code.eq(pc.postId_count_emoji),
						pf.num.gt0,
						pf.txt.eq(input.emoji),
					),
				),
			),
	);
	if (reactionId__postId__emojiRows.length) throw new Error(`Already added this reaction`);
	assert1Row(postId__parentPostId_lastVersionRows);
	assertLt2Rows(postId_count_emojiRows)
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
				code: pc.postId_count_emoji,
				num: 1,
				txt: input.emoji,
			});

	console.log('partsToInsert', JSON.stringify(partsToInsert, null, 2));
	await db.insert(pTable).values(partsToInsert);
	return { ms };
};
