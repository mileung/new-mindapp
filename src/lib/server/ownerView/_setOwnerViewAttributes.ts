import { ownerMsSet, rulesAllowEmail } from '$lib/js';
import { m } from '$lib/paraglide/messages';
import { tdb } from '$lib/server/db';
import { id0 } from '$lib/types/parts/partIds';
import { and, or } from 'drizzle-orm';
import { channelPartsByCode, type WhoObj } from '../../types/parts';
import { pc } from '../../types/parts/partCodes';
import { pf } from '../../types/parts/partFilters';
import { pTable } from '../../types/parts/partsTable';

export let _setOwnerViewAttributes = async (
	input: WhoObj & {
		//
		signedInEmailRules: string[];
	},
) => {
	let id__signedInEmailRulesRowsFilter = and(
		pf.noAtId,
		pf.in_ms.eq0,
		pf.code.eq(pc.id__signedInEmailRules),
		pf.num.isNull,
		pf.txt.isNotNull,
	);
	let {
		[pc.id__signedInEmailRules]: id__signedInEmailRulesRows = [],
		[pc.msByMs__accountEmail]: msByMs__accountEmailRows = [],
	} = channelPartsByCode(
		await tdb
			.select()
			.from(pTable)
			.where(
				or(
					id__signedInEmailRulesRowsFilter, //
					and(
						pf.noAtId,
						pf.ms.gt0,
						or(...[...ownerMsSet].map((ms) => pf.by_ms.eq(ms))),
						pf.in_ms.eq0,
						pf.code.eq(pc.msByMs__accountEmail),
						pf.num.isNull,
						pf.txt.isNotNull,
					),
				),
			),
	);

	if (!msByMs__accountEmailRows.length) throw new Error(`No owner email founds`);
	if (msByMs__accountEmailRows.some((r) => !rulesAllowEmail(input.signedInEmailRules, r.txt!)))
		throw new Error(m.rulesMustAllowAllOwnerEmails());

	let ms = Date.now();
	let txt = input.signedInEmailRules.join('\n');
	if (!id__signedInEmailRulesRows.length) {
		await tdb.insert(pTable).values({
			...id0,
			ms,
			by_ms: input.callerMs,
			code: pc.id__signedInEmailRules,
			txt,
		});
	} else {
		await tdb
			.update(pTable)
			.set({
				ms,
				by_ms: input.callerMs,
				txt,
			})
			.where(id__signedInEmailRulesRowsFilter);
	}

	if (input.signedInEmailRules.length) {
		// TODO: only sign out accounts whose emails the new rules do not allow
		await tdb
			.delete(pTable)
			.where(
				and(
					pf.notAtId({ at_ms: input.callerMs }),
					pf.at_ms.gt0,
					pf.at_by_ms.gt0,
					pf.at_in_ms.gt0,
					pf.ms.gt0,
					pf.in_ms.eq0,
					pf.code.eq(pc.ms_ExpiryMs__accountMs__sessionKey),
					pf.txt.isNotNull,
				),
			);
	}

	return {};
};
