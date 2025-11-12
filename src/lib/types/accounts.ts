import { z } from 'zod';

export let AccountSchema = z
	.object({
		ms: z.number().nullable(),
		spaceMss: z.array(z.number().nullable()),
		spaceMssMs: z.number().nullish(),
		savedTags: z.array(z.string()),
		savedTagsMs: z.number().nullish(),
		email: z.string().nullish(),
		emailMs: z.number().nullish(),
		pwHash: z.string().nullish(),
		pwHashMs: z.number().nullish(),
		name: z.string().nullish(),
		nameMs: z.number().nullish(),
	})
	.strict();

export type Account = z.infer<typeof AccountSchema>;
