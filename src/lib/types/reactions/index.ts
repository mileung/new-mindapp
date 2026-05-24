import { is1Emoji } from '$lib/js';
import { z } from 'zod';
import { shortReactionList } from './reactionList';

export let EmojiStringSchema = z.string().refine(
	(s) => is1Emoji(s), //
	'emoji must pass is1Emoji',
);
export let ReactionSchema = z
	.strictObject({
		at_ms: z.number(),
		at_by_ms: z.number(),
		at_in_ms: z.number(),
		ms: z.number(),
		by_ms: z.number(),
		in_ms: z.number(),
		emoji: EmojiStringSchema,
	})
	.superRefine((data, ctx) => {
		if (data.at_in_ms !== data.in_ms) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: '`at_in_ms` must equal `in_ms`',
				path: ['in_ms'],
			});
		}
	});

export type Reaction = z.infer<typeof ReactionSchema>;
export type RxnEmoji = (typeof shortReactionList)[number];
