import { z } from 'zod';
import type { pc } from '../parts/partCodes';

export let OtpSchema = z
	.object({
		partCode: z.number(),
		pin: z.string(),
		email: z.string(),
		strike: z.number(),
	})
	.strict();

export type Otp = z.infer<typeof OtpSchema>;

export type OtpPartCode =
	| typeof pc.createAccountOtpMsWithTxtAsEmailSpacePinAndNumAsStrikeCount
	| typeof pc.signInOtpMsWithTxtAsEmailSpacePinAndNumAsStrikeCount
	| typeof pc.resetPasswordOtpMsWithTxtAsEmailSpacePinAndNumAsStrikeCount;
