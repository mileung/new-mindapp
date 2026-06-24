import { ownerMsSet, rulesAllowEmail, throwIf } from '$lib/js';
import { m } from '$lib/paraglide/messages';
import { tdb } from '$lib/server/db';
import { and, or } from 'drizzle-orm';
import { channelPartsByCode, type WhoObj } from '../../types/parts';
import { pc } from '../../types/parts/partCodes';
import { pf } from '../../types/parts/partFilters';
import { pTable } from '../../types/parts/partsTable';

export let _setOwnerViewAttributes = async (
	input: WhoObj & {
		signedInEmailRules: string[];
	},
) => {
	let {
		[pc._signedInEmailRules_mb]: _signedInEmailRules_mbRows = [],
		[pc._accountEmail_bm]: _accountEmail_bmRows = [],
	} = channelPartsByCode(
		await tdb
			.select()
			.from(pTable)
			.where(
				or(
					pf.code.eq(pc._signedInEmailRules_mb),
					and(
						pf.code.eq(pc._accountEmail_bm), //
						or(...[...ownerMsSet].map((ms) => pf.p1.eq(ms))),
					),
				),
			),
	);
	throwIf(!_accountEmail_bmRows.length);
	if (_accountEmail_bmRows.some((r) => !rulesAllowEmail(input.signedInEmailRules, r.txt!)))
		throw new Error(m.rulesMustAllowAllOwnerEmails());

	let now = Date.now();
	let txt = input.signedInEmailRules.join('\n');
	if (!_signedInEmailRules_mbRows.length) {
		await tdb.insert(pTable).values({
			code: pc._signedInEmailRules_mb,
			txt,
			p1: now,
			p2: input.callerMs,
		});
	} else {
		await tdb
			.update(pTable)
			.set({
				txt,
				p1: now,
				p2: input.callerMs,
			})
			.where(pf.code.eq(pc._signedInEmailRules_mb));
	}

	if (input.signedInEmailRules.length) {
		// TODO: only sign out accounts whose emails the new rules do not allow
		await tdb.delete(pTable).where(
			and(
				pf.code.eq(pc._sessionKey_m_accountMs_expiryMs),
				pf.p2.notEq(input.callerMs), //
			),
		);
	}

	return {};
};
