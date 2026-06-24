import { tdb } from '$lib/server/db';
import { minute } from '$lib/time';
import { assert1Row } from '$lib/types/parts';
import { pTable } from '$lib/types/parts/partsTable';
import { and } from 'drizzle-orm';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';

export let _checkOtp = async (input: {
	otpMs: number;
	pin: string;
	email: string;
	deleteIfCorrect: boolean;
}): Promise<{ strike?: number; expiredOtp?: true }> => {
	if (Date.now() - input.otpMs > 5 * minute) return { expiredOtp: true };
	let _email_ms_strikeCount_otpFilter = and(
		pf.code.eq(pc._email_ms_strikeCount_pin),
		pf.txt.eq(input.email),
		pf.p1.eq(input.otpMs),
		pf.p2.lt(3),
	);
	let _email_ms_strikeCount_otpRow = assert1Row(
		await tdb
			.select() //
			.from(pTable)
			.where(_email_ms_strikeCount_otpFilter)
			.limit(1),
	);
	let { p3 } = _email_ms_strikeCount_otpRow;
	if (p3! < 0 || p3 !== +input.pin) {
		let strike = _email_ms_strikeCount_otpRow.p2!;
		await tdb
			.update(pTable) //
			.set({ p2: ++strike })
			.where(_email_ms_strikeCount_otpFilter);
		return { strike };
	}
	if (input.deleteIfCorrect) await tdb.delete(pTable).where(_email_ms_strikeCount_otpFilter);
	return {};
};
