import { dev } from '$app/environment';
import { _getEmailRow } from '$lib/server/_getEmailRow';
import { tdb } from '$lib/server/db';
import { throwIf } from '$lib/server/errors';
import type { OtpPartCode } from '.';
import { pc } from '../parts/partCodes';
import { id0 } from '../parts/partIds';
import { pTable } from '../parts/partsTable';

export let _sendOtp = async (input: { email: string; partCode: OtpPartCode }) => {
	let accountRow = await _getEmailRow(input.email);
	throwIf(
		accountRow
			? input.partCode === pc.createAccountOtpMsWithTxtAsEmailColonPinAndNumAsStrikeCount
			: input.partCode === pc.resetPasswordOtpMsWithTxtAsEmailColonPinAndNumAsStrikeCount,
	);

	let pin = ('' + Math.random()).slice(-8);
	if (dev) {
		pin = '00000000';
	} else {
		// await sendEmail({
		// 	from: 'noreply@yourdomain.com',
		// 	to: email,
		// 	subject: 'Your Login Code',
		// 	html: `${otp}`,
		// });
	}
	let ms = Date.now();
	await tdb.insert(pTable).values({
		...id0,
		ms,
		code: input.partCode,
		num: 0,
		txt: `${input.email}:${pin}`,
	});
	return { otpMs: ms };
};
