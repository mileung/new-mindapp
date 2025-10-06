import { z } from 'zod';

export let OtpSchema = z
	.object({
		email: z.string(),
		pin: z.string(),
		strike: z.number(),
	})
	.strict();

export type Otp = z.infer<typeof OtpSchema>;
