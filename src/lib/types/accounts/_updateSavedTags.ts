import type { WhoObj } from '../parts';

export let _updateSavedTags = async (
	input: WhoObj & {
		tags: string[];
		remove: boolean;
	},
) => {
	let ms = Date.now();
	// let savedTagsRowFilter = and(
	// 	pt.at_ms.e0,
	// 	pt.at_by_ms.e0,
	// 	pt.at_in_ms.e0,
	// 	pt.ms.e0,
	// 	pt.by_ms.e0,
	// 	pt.in_ms.eq(input.callerMs),
	// 	// pf.code.eq(' savedTags'),
	// 	isNotNull(pTable.txt),
	// );
	// let savedTagsRows = await tdb.select().from(pTable).where(savedTagsRowFilter);
	// if (savedTagsRows.length > 1) throw new Error('Multiple savedTagsRows found');
	// let savedTagsRow = savedTagsRows[0];
	// if (!savedTagsRow) throw new Error('savedTagsRow dne');
	// let savedTags: string[] = JSON.parse(savedTagsRow.txt!);
	// let removingSet = new Set(input.removing);
	// let newSavedTags: string[] = normalizeTags([...savedTags, ...input.adding]).filter(
	// 	(t) => !removingSet.has(t),
	// );
	// await tdb
	// 	.update(pTable)
	// 	.set({
	// 		ms,
	// 		txt: JSON.stringify(newSavedTags),
	// 	})
	// 	.where(savedTagsRowFilter);
	return { ms };
};
