import { dev } from '$app/environment';
import { tdb } from '$lib/server/db';
import { and } from 'drizzle-orm';
import { assertLt2Rows } from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
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
	let sendOtp = true;
	if (will.signIn) {
		// _signIn already checks for email row
	} else {
		let _accountEmail_bmRow = assertLt2Rows(
			await tdb
				.select()
				.from(pTable)
				.where(
					and(
						pf.code.eq(pc._accountEmail_bm),
						pf.txt.eq(email), //
					),
				),
		);
		if (
			(will.createAccount && _accountEmail_bmRow) ||
			(will.resetPassword && !_accountEmail_bmRow) //
		)
			sendOtp = false;
	}

	let pin = -1;
	let now = Date.now();
	if (sendOtp) {
		pin = dev ? 0 : +('' + Math.random()).slice(-8);
		// await sendEmail({
		// 	from: 'noreply@yourdomain.com',
		// 	to: email,
		// 	subject: 'Your Login Code',
		// 	html: `${otp}`,
		// });
	}
	await tdb.insert(pTable).values({
		code: pc._email_ms_strikeCount_pin,
		txt: email,
		p1: now,
		p2: 0,
		p3: pin,
	});
	return { otpMs: now };
};
