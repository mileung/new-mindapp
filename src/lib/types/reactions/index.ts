import { is1Emoji } from '$lib/js';
import { z } from 'zod';
import { shortReactionList } from './reactionList';

export let EmojiStringSchema = z.string().refine(
	(s) => is1Emoji(s), //
	'emoji must pass is1Emoji',
);
export let ReactionSchema = z
	.strictObject({
		at_ms: z.number().gte(0),
		at_by_ms: z.number().gte(0),
		at_in_ms: z.number().gte(0),
		ms: z.number().gte(0),
		by_ms: z.number().gte(0),
		in_ms: z.number().gte(0),
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
