import { gs } from '$lib/global-state.svelte';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { gsdb } from '../../local-db';
import { pt } from './partFilters';
import { getIdStr, type AtIdObj, type FullIdObj, type IdObj } from './partIds';
import { pTable } from './partsTable';

export type PartInsert = typeof pTable.$inferInsert;
export type PartSelect = typeof pTable.$inferSelect;

export let PartInsertSchema = createInsertSchema(pTable);
export let PartSelectSchema = createSelectSchema(pTable);

export let BaseInputSchema = z.object({
	callerMs: z.number(),
	spaceMs: z.number(),
});
export type BaseInput = z.infer<typeof BaseInputSchema>;

export let getBaseInput = async () => {
	let attempts = 0;
	while (gs.accounts === undefined || gs.currentSpaceMs === undefined) {
		if (++attempts > 888) {
			throw new Error(`getBaseInput ${attempts} ${JSON.stringify(gs)} error`);
		}
		await new Promise((res) => setTimeout(res, 42));
	}
	return {
		callerMs: gs.accounts[0].ms,
		spaceMs: gs.currentSpaceMs,
	} satisfies BaseInput;
};

export let hasParent = (part: FullIdObj) =>
	part.at_ms !== 0 || //
	part.at_by_ms !== 0 ||
	part.at_in_ms !== 0;

export let overwriteLocalPost = async (t: PartInsert) => {
	await (await gsdb()).update(pTable).set(t).where(pt.id(t));
};

export let assertLt2Rows = (parts: PartSelect[]) => {
	if (parts.length > 1) throw new Error(`Multiple parts found`);
	let row = parts[0];
	return row as undefined | PartSelect;
};

export let assert1Row = (parts: PartSelect[]) => {
	let row = assertLt2Rows(parts);
	if (!row) throw new Error(`row dne`);
	return row;
};

export let channelPartsByCode = (parts: PartSelect[]) => {
	let partCodeToRowMap: Record<number, PartSelect[]> = {};
	for (let i = 0; i < parts.length; i++) {
		let part = parts[i];
		partCodeToRowMap[part.code] = partCodeToRowMap[part.code] || [];
		partCodeToRowMap[part.code].push(part);
	}
	return partCodeToRowMap;
};

export let makePartsUniqueById = (parts: PartSelect[]) => {
	let idSet = new Set<string>();
	let uniqueParts: PartSelect[] = [];
	for (let i = 0; i < parts.length; i++) {
		let part = parts[i];
		let partIdStr = getIdStr(part);
		if (!idSet.has(partIdStr)) {
			idSet.add(partIdStr);
			uniqueParts.push(part);
		}
	}
	return uniqueParts;
};

export let reduceTxtRowsToMap = (tagOrCoreTxtRows: PartSelect[]) => {
	let idToTxtMap: Record<string, string> = {};
	for (let i = 0; i < tagOrCoreTxtRows.length; i++) {
		let tagTxtRow = tagOrCoreTxtRows[i];
		idToTxtMap[getIdStr(tagTxtRow)] = tagTxtRow.txt!;
	}
	return idToTxtMap;
};

export let idObjMatchesIdObj = (io1: IdObj, io2: IdObj) =>
	io1.ms === io2.ms && //
	io1.by_ms === io2.by_ms &&
	io1.in_ms === io2.in_ms;

export let atIdObjMatchesIdObj = (aio: AtIdObj, io: IdObj) =>
	aio.at_ms === io.ms && //
	aio.at_by_ms === io.by_ms &&
	aio.at_in_ms === io.in_ms;
