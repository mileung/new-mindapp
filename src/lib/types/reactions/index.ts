import { z } from 'zod';
import { reactionList } from './reactionList';

export let ReactionSchema = z
	.object({
		at_ms: z.number().gte(0),
		at_by_ms: z.number().gte(0),
		at_in_ms: z.number().gte(0),
		ms: z.number().gte(0),
		by_ms: z.number().gte(0),
		in_ms: z.number().gte(0),
		emoji: z.enum(reactionList),
	})
	.strict()
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
export type RxnEmoji = (typeof reactionList)[number];
