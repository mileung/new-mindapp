import { z } from 'zod';

export let SpaceSchema = z
	.object({
		ms: z.number(),
	})
	.strict();

export type Space = z.infer<typeof SpaceSchema>;
