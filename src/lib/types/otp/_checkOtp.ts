import { tdb } from '$lib/server/db';
import { minute } from '$lib/time';
import { assert1Row } from '$lib/types/parts';
import { pTable } from '$lib/types/parts/partsTable';
import { and, like } from 'drizzle-orm';
import { type OtpPartCode } from '.';
import { pf } from '../parts/partFilters';

export let _checkOtp = async (
	input: {
		otpMs: number;
		partCode: OtpPartCode;
		pin: string;
		email: string;
		deleteIfCorrect?: boolean;
	},
	otpMaxMinAge = 3,
): Promise<{ strike?: number; expiredOtp?: true }> => {
	if (Date.now() - input.otpMs > otpMaxMinAge * minute) return { expiredOtp: true };
	let otpRowsFilter = and(
		pf.noAtId,
		pf.id({ ms: input.otpMs }),
		pf.code.eq(input.partCode),
		pf.num.gte0,
		like(pTable.txt, `${input.email} %`),
	);
	let otpRow = assert1Row(
		await tdb
			.select() //
			.from(pTable)
			.where(otpRowsFilter)
			.limit(1),
	);
	if (otpRow.txt !== `${input.email} ${input.pin}`) {
		let strike = otpRow.num;
		await tdb
			.update(pTable) //
			.set({ num: ++strike })
			.where(otpRowsFilter);
		return { strike };
	}
	if (input.deleteIfCorrect) await tdb.delete(pTable).where(otpRowsFilter);
	return {};
};
