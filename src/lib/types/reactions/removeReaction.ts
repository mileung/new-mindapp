import { gsdb } from '$lib/global-state.svelte';
import { is1Emoji } from '$lib/js';
import { trpc } from '$lib/trpc/client';
import { and, or, SQL } from 'drizzle-orm';
import { type Database } from '../../local-db';
import { assert1Row, channelPartsByCode, type WhoObj } from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { type IdObj } from '../parts/partIds';
import { pTable } from '../parts/partsTable';
import { moveTagCoreOrRxnCountsBy1 } from '../posts';

export let removeReaction = async (
	input: WhoObj & {
		postIdObj: IdObj;
		emoji: string;
	},
	useLocalDb: boolean,
) => {
	if (!is1Emoji(input.emoji)) throw new Error(`Failed is1Emoji`);
	return useLocalDb
		? _removeReaction(await gsdb(), input, true)
		: trpc().removeReaction.mutate(input);
};

export let _removeReaction = async (
	db: Database,
	input: WhoObj & {
		postIdObj: IdObj;
		emoji: string;
	},
	useLocalDb: boolean,
) => {
	let rxnInMs = useLocalDb ? 0 : input.postIdObj.in_ms;
	let caller_reactionId__postId__emojiFilter = and(
		pf.idAsAtId(input.postIdObj),
		pf.ms.gt0,
		pf.by_ms.eq(input.callerMs),
		pf.in_ms.eq(rxnInMs),
		pf.code.eq(pc.reactionId__postId__emoji),
		pf.num.isNull,
		pf.txt.eq(input.emoji),
	);
	let {
		[pc.reactionId__postId__emoji]: reactionId__postId__emojiRows = [],
		[pc.postId_count_emoji]: postId_count_emojiRows = [],
	} = channelPartsByCode(
		await db
			.select()
			.from(pTable)
			.where(
				or(
					caller_reactionId__postId__emojiFilter,
					and(
						pf.id(input.postIdObj),
						pf.code.eq(pc.postId_count_emoji),
						pf.num.gt0,
						pf.txt.eq(input.emoji),
					),
				),
			),
	);
	if (!reactionId__postId__emojiRows.length) throw new Error(`Reaction dne`);
	let deleteFilters: (undefined | SQL)[] = [caller_reactionId__postId__emojiFilter];
	let postId_count_emojiRow = assert1Row(postId_count_emojiRows);
	postId_count_emojiRow.num! > 1
		? await moveTagCoreOrRxnCountsBy1(
				db,
				[],
				[],
				[{ ...input.postIdObj, emoji: input.emoji }],
				false,
			)
		: deleteFilters.push(
				and(
					pf.noAtId,
					pf.id(input.postIdObj),
					pf.code.eq(pc.postId_count_emoji),
					pf.num.lt(2),
					pf.txt.eq(input.emoji),
				),
			);

	await db.delete(pTable).where(or(...deleteFilters));
	return {};
};
