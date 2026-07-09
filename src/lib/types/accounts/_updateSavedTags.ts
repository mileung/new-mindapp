import { tdb } from '$lib/server/db';
import { and } from 'drizzle-orm';
import { assert1Row, type WhoObj } from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { pTable } from '../parts/partsTable';
import { cleanTags } from '../posts';

export let _updateSavedTags = async (
	input: WhoObj & {
		addTags: string[];
		removeTags: string[];
	},
) => {
	let now = Date.now();
	let _accountSavedTags_bmFilter = and(
		pf.code.eq(pc._accountSavedTags_bm),
		pf.p1.eq(input.callerMs), //
	);

	let _accountSavedTags_bmRows = await tdb
		.select()
		.from(pTable) //
		.where(_accountSavedTags_bmFilter);
	let _accountSavedTags_bmRow = assert1Row(_accountSavedTags_bmRows);

	let savedTags: string[] = JSON.parse(_accountSavedTags_bmRow.txt!);
	let newSavedTags = cleanTags(
		[...savedTags, ...input.addTags].filter((t) => !input.removeTags.includes(t)),
		true,
	);

	await tdb
		.update(pTable)
		.set({
			txt: JSON.stringify(newSavedTags),
			p2: now,
		})
		.where(_accountSavedTags_bmFilter);

	return { ms: now };
};
