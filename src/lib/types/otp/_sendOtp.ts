import { dev } from '$app/environment';
import { RESEND_API_KEY } from '$env/static/private';
import { m } from '$lib/paraglide/messages';
import { tdb } from '$lib/server/db';
import { and } from 'drizzle-orm';
import { Resend } from 'resend';
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
		if (dev) pin = 0;
		else {
			pin = +('' + Math.random()).slice(-8);
			let result = await sendEmail({
				from: 'Mindapp <noreply@updates.mindapp.cc>',
				to: email,
				subject: m.oneTimePinP({ p: pin }),
				html:
					m.yourOneTimePinForMindappIs() +
					`\n<p style="font-family: monospace; font-size: 24px; font-weight: bold;">${pin}</p>\n\n` +
					m.thisCanOnlyBeUsedOnTheDeviceUsedToRequestThisEmail(),
			});
			if (result.error) throw new Error(m.emailServiceProviderError());
		}
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

let sendEmail = async (config: { from: string; to: string; subject: string; html: string }) => {
	let resend = new Resend(RESEND_API_KEY);
	return await resend.emails.send(config);
};
