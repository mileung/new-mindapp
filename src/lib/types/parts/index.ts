import { throwIf } from '$lib/js';
import { z } from 'zod';
import { type FullIdObj } from './partIds';
import { pTable } from './partsTable';

export type PartInsert = typeof pTable.$inferInsert;
export type PartSelect = typeof pTable.$inferSelect;

export let GranularNumPropSchema = z.strictObject({
	ms: z.number().optional(),
	by_ms: z.number().optional(),
	num: z.number(),
});
export type GranularNumProp = z.infer<typeof GranularNumPropSchema>;

export let sameGranularNum = (a?: GranularNumProp, b?: GranularNumProp) =>
	a?.ms === b?.ms && a?.by_ms === b?.by_ms && a?.num === b?.num;

export let GranularTxtPropSchema = z.strictObject({
	ms: z.number().optional(),
	by_ms: z.number().optional(),
	txt: z.string(),
});
export type GranularTxtProp = z.infer<typeof GranularTxtPropSchema>;

export let WhoObjSchema = z.strictObject({
	callerMs: z.number(),
});
export type WhoObj = z.infer<typeof WhoObjSchema>;

export let WhoWhereObjSchema = WhoObjSchema.extend({
	spaceMs: z.number(),
});
export type WhoWhereObj = z.infer<typeof WhoWhereObjSchema>;

export let hasParent = (part: FullIdObj) =>
	Number.isInteger(part.at_ms) && Number.isInteger(part.at_by_ms);

export let assertLt2Rows = (parts: PartInsert[]) => {
	throwIf(parts.length > 1);
	let row = parts[0];
	return row as undefined | PartSelect;
};

export let assert1Row = (parts: PartInsert[]) => {
	let row = assertLt2Rows(parts);
	throwIf(!row);
	return row!;
};

export let channelPartsByCode = (parts: PartInsert[]) => {
	let partCodeToRowMap: Record<number, PartInsert[]> = {};
	for (let i = 0; i < parts.length; i++) {
		let part = parts[i];
		partCodeToRowMap[part.code] = partCodeToRowMap[part.code] || [];
		partCodeToRowMap[part.code].push(part);
	}
	return partCodeToRowMap;
};
