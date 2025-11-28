import { dev } from '$app/environment';
import { assert1Row } from '$lib/types/parts';
import { pTable } from '$lib/types/parts/partsTable';
import { and, like } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '$lib/local-db';
import type { pc } from './parts/partCodes';
import { zeros } from './parts/partIds';
import { pt } from './parts/partFilters';

export let OtpSchema = z
	.object({
		partCode: z.number(),
		pin: z.string(),
		email: z.string(),
		strike: z.number(),
	})
	.strict();

export type Otp = z.infer<typeof OtpSchema>;

type OtpPartCode =
	| typeof pc.createAccountOtpWithTxtAsEmailColonPinAndNumAsStrikeCount
	| typeof pc.signInOtpWithTxtAsEmailColonPinAndNumAsStrikeCount
	| typeof pc.resetPasswordOtpWithTxtAsEmailColonPinAndNumAsStrikeCount;

export let _sendOtp = async (db: Database, email: string, partCode: OtpPartCode) => {
	let pin = ('' + Math.random()).slice(-8);
	if (dev) {
		pin = '00000000';
		// console.log('pin:', pin);
	} else {
		// await resend.emails.send({
		// 	from: 'noreply@yourdomain.com',
		// 	to: email,
		// 	subject: 'Your Login Code',
		// 	html: `${otp}`,
		// });
	}

	let ms = Date.now();
	await db.insert(pTable).values({
		...zeros,
		ms,
		code: partCode,
		txt: `${email}:${pin}`,
		num: 0,
	});
	return { otpMs: ms };
};

export let _checkOtp = async (
	db: Database,
	input: {
		otpMs: number;
		partCode: OtpPartCode;
		pin: string;
		email: string;
	},
): Promise<{ strike?: number }> => {
	let otpRowsFilter = and(
		pt.at_ms.eq0,
		pt.at_by_ms.eq0,
		pt.at_in_ms.eq0,
		pt.ms.eq(input.otpMs),
		pt.ms.eq0,
		pt.in_ms.eq0,
		pt.code.eq(input.partCode),
		like(pTable.txt, `${input.email}:%`),
		pt.num.isNotNull,
	);
	let otpRows = await db.select().from(pTable).where(otpRowsFilter);
	let otpRow = assert1Row(otpRows);
	let [email, pin] = otpRow.txt!.split(':');
	let strike = otpRow.num!;
	let otp: Otp = {
		email,
		pin,
		strike,
		partCode: otpRow.code!,
	};
	if (!OtpSchema.safeParse(otp).success) throw new Error('Invalid OTP');
	console.log('otp:', otp);
	console.log('input:', input);
	if (input.pin !== otp.pin) {
		await db.update(pTable).set({ num: ++strike }).where(otpRowsFilter);
		return { strike };
	}
	return {};
};
