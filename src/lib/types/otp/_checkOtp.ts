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
	deleteIfCorrect?: boolean;
}): Promise<{ strike?: number; expiredOtp?: true }> => {
	if (Date.now() - input.otpMs > 5 * minute) return { expiredOtp: true };
	let otpRowsFilter = and(
		pf.noAtId,
		pf.ms.eq(input.otpMs),
		pf.in_ms.lt(3),
		pf.code.eq(pc.otpMs_Pin_StrikeCountIdAndEmailTxt),
		pf.num.isNull,
		pf.txt.eq(input.email),
	);
	let otpRow = assert1Row(
		await tdb
			.select() //
			.from(pTable)
			.where(otpRowsFilter)
			.limit(1),
	);
	if (otpRow.by_ms !== +input.pin) {
		let strike = otpRow.in_ms;
		await tdb
			.update(pTable) //
			.set({ in_ms: ++strike })
			.where(otpRowsFilter);
		return { strike };
	}
	if (input.deleteIfCorrect) await tdb.delete(pTable).where(otpRowsFilter);
	return {};
};
