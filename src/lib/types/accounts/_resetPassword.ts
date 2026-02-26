import { _getEmailRow } from '$lib/server/_getEmailRow';
import { tdb } from '$lib/server/db';
import { throwIf } from '$lib/server/errors';
import { filterAccountPwHashRow } from '$lib/types/accounts';
import { pTable } from '$lib/types/parts/partsTable';
import * as argon2 from 'argon2';
import { _checkOtp } from '../otp/_checkOtp';
import { pc } from '../parts/partCodes';

export let _resetPassword = async (input: {
	otpMs: number;
	pin: string;
	email: string;
	password: string;
}) => {
	let res = await _checkOtp(
		{
			...input,
			deleteIfCorrect: true,
			partCode: pc.resetPasswordOtpMsWithTxtAsEmailSpacePinAndNumAsStrikeCount,
		},
		8,
	);
	if (res.strike || res.expiredOtp) return res;

	let emailRow = await _getEmailRow(input.email);
	throwIf(!emailRow);

	await tdb
		.update(pTable)
		.set({
			ms: Date.now(),
			txt: await argon2.hash(input.password),
		})
		.where(filterAccountPwHashRow(emailRow!.at_ms));
};
