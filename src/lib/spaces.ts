import { z } from 'zod';

export let SpaceSchema = z
	.object({
		id: z.number(),
	})
	.strict();

export type Space = z.infer<typeof SpaceSchema>;
