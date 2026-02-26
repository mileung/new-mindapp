import { gs } from '$lib/global-state.svelte';
import { z } from 'zod';
import { gsdb } from '../../local-db';
import { pf } from './partFilters';
import { getAtIdStr, getIdStr, type AtIdObj, type FullIdObj, type IdObj } from './partIds';
import { pTable } from './partsTable';

export type PartInsert = typeof pTable.$inferInsert;
export type PartSelect = typeof pTable.$inferSelect;

export let GranularNumPropSchema = z.object({
	ms: z.number().optional(),
	by_ms: z.number().optional(),
	num: z.number(),
});
export type GranularNumProp = z.infer<typeof GranularNumPropSchema>;
export let getGranularNumProp = (part: PartInsert) =>
	({
		ms: part.ms,
		by_ms: part.by_ms,
		num: part.num,
	}) satisfies GranularNumProp;

export let GranularTxtPropSchema = z.object({
	ms: z.number().optional(),
	by_ms: z.number().optional(),
	txt: z.string(),
});
export type GranularTxtProp = z.infer<typeof GranularTxtPropSchema>;
export let getGranularTxtProp = (part: PartInsert) =>
	({
		ms: part.ms,
		by_ms: part.by_ms,
		txt: part.txt!,
	}) satisfies GranularTxtProp;

export let GranularNumTxtPropSchema = z.object({
	ms: z.number().optional(),
	by_ms: z.number().optional(),
	num: z.number(),
	txt: z.string(),
});
export type GranularNumTxtProp = z.infer<typeof GranularNumTxtPropSchema>;
export let getGranularNumTxtProp = (part: PartInsert) =>
	({
		ms: part.ms,
		by_ms: part.by_ms,
		num: part.num,
		txt: part.txt!,
	}) satisfies GranularNumTxtProp;

export let WhoObjSchema = z.object({
	callerMs: z.number().gte(0),
});
export type WhoObj = z.infer<typeof WhoObjSchema>;

export let WhoWhereObjSchema = WhoObjSchema.merge(
	z.object({
		spaceMs: z.number().gte(0),
	}),
);
export type WhoWhereObj = z.infer<typeof WhoWhereObjSchema>;

export let getWhoObj = async () => {
	let attempts = 0;
	while (gs.accounts === undefined) {
		if (++attempts > 888) throw new Error(`getWhoObj timed out`);
		await new Promise((res) => setTimeout(res, 42));
	}
	return {
		callerMs: gs.accounts[0].ms,
	} satisfies WhoObj;
};

export let getWhoWhereObj = async () => {
	let attempts = 0;
	while (gs.accounts === undefined || gs.urlInMs === undefined) {
		if (++attempts > 888) throw new Error(`getWhoWhereObj timed out`);
		await new Promise((res) => setTimeout(res, 42));
	}
	return {
		callerMs: gs.accounts[0].ms,
		spaceMs: gs.urlInMs,
	} satisfies WhoWhereObj;
};

export let hasParent = (part: FullIdObj) =>
	part.at_ms !== 0 || //
	part.at_by_ms !== 0 ||
	part.at_in_ms !== 0;

export let overwriteLocalPost = async (t: PartInsert) => {
	await (await gsdb()).update(pTable).set(t).where(pf.id(t));
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

export let makePartsUniqueByAtId = (parts: PartSelect[]) => {
	let atIdSet = new Set<string>();
	let uniqueParts: PartSelect[] = [];
	for (let i = 0; i < parts.length; i++) {
		let part = parts[i];
		let partAtIdStr = getAtIdStr(part);
		if (!atIdSet.has(partAtIdStr)) {
			atIdSet.add(partAtIdStr);
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
