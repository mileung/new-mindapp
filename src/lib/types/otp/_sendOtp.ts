import { dev } from '$app/environment';
import { _getEmailRow } from '$lib/server/_getEmailRow';
import { tdb } from '$lib/server/db';
import { throwIf } from '$lib/server/errors';
import { pc } from '../parts/partCodes';
import { id0 } from '../parts/partIds';
import { pTable } from '../parts/partsTable';

export let _sendOtp = async (input: {
	email: string;
	will: {
		createAccount?: boolean;
		signIn?: boolean;
		resetPassword?: boolean;
	};
}): Promise<{
	otpMs?: number;
	fail?: true;
}> => {
	let { email, will } = input;
	if (!will.signIn) {
		// _signIn already checks for email row
		let emailRow = await _getEmailRow(email);
		throwIf(will.createAccount ? emailRow : !emailRow);
	}

	let pin = +('' + Math.random()).slice(-8);
	if (dev) {
		pin = 0;
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
		by_ms: pin,
		code: pc.otpMs_Pin_StrikeCountIdAndEmailTxt,
		txt: email,
	});
	return { otpMs: ms };
};
