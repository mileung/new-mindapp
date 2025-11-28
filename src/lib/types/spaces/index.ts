import { z } from 'zod';

export let SpaceSchema = z
	.object({
		ms: z.number(),
		name: z.string().optional(),
	})
	.strict();

export type Space = z.infer<typeof SpaceSchema>;
