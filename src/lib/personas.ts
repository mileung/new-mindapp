import { z } from 'zod';

export let PersonaPublicSchema = z
	.object({
		id: z.number(), // date of creation in ms
		name: z.string(),
	})
	.strict();

export let PersonaPrivateSchema = z
	.object({
		space_ids: z.array(z.string()),
		tags: z.array(z.string()),
	})
	.strict();

export type PersonaPublic = z.infer<typeof PersonaPublicSchema>;
export type PersonaPrivate = z.infer<typeof PersonaPrivateSchema>;
