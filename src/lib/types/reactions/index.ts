import { is1Emoji } from '$lib/js';
import { z } from 'zod';
import { shortReactionList } from './reactionList';

export let EmojiStringSchema = z.string().refine(
	(s) => is1Emoji(s), //
	'emoji must pass is1Emoji',
);
export let ReactionSchema = z.strictObject({
	post_in_ms: z.number(),
	post_ms: z.number(),
	post_by_ms: z.number(),
	emoji: EmojiStringSchema,
	rxn_ms: z.number(),
	rxn_by_ms: z.number(),
});

export type Reaction = z.infer<typeof ReactionSchema>;
export type RxnEmoji = (typeof shortReactionList)[number];
