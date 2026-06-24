import { page } from '$app/state';
import { splitUntil } from '$lib/js';
import { z } from 'zod';
import { hasParent } from '.';

export let IdObjSchema = z.strictObject({
	ms: z.number(),
	by_ms: z.number(),
	in_ms: z.number(),
});
export type IdObj = z.infer<typeof IdObjSchema>;

export let FullIdObjSchema = IdObjSchema.merge(
	z.strictObject({
		at_ms: z.number().optional(),
		at_by_ms: z.number().optional(),
	}),
);
export type FullIdObj = z.infer<typeof FullIdObjSchema>;

export let idRegex = /^\d+_\d+_\d+$/;
export let idsRegex = /(?<!\S)(\d+_\d+_\d+)(?!\S)/g;

export let isSpaceSlug = (str = '') => /^\d+__$/.test(str);
export let isProfileSlug = (str = '') => /^__\d+$/.test(str);
export let isIdStr = (str = '') => idRegex.test(str);
export let getUrlInMs = () => {
	let slug = splitUntil(page.url.pathname, '/', 2)[1];
	if (isSpaceSlug(slug)) return +slug.slice(0, -2);
	if (isIdStr(slug)) return getIdStrAsIdObj(slug).in_ms;
};

export let getIdStr = (o: IdObj) => `${o.in_ms}_${o.ms}_${o.by_ms}`;
export let getIdObj = (o: IdObj) => ({ in_ms: o.in_ms, ms: o.ms, by_ms: o.by_ms });
export let getAtIdStr = (o: FullIdObj) =>
	hasParent(o) ? `${o.in_ms}_${o.at_ms}_${o.at_by_ms}` : '';
export let getAtIdObjAsIdObj = (o: FullIdObj) => ({
	ms: o.at_ms,
	by_ms: o.at_by_ms,
	in_ms: o.in_ms,
});
export let getIdStrAsIdObj = (idStr: string) => {
	let s = splitUntil(idStr, '_', 2);
	let in_ms = +s[0];
	let ms = +s[1];
	let by_ms = +s[2];
	if (
		!s[0] ||
		!s[1] ||
		!s[2] || //
		!Number.isInteger(in_ms) ||
		!Number.isInteger(ms) ||
		!Number.isInteger(by_ms)
	)
		throw new Error(`invalid idStr`);
	return {
		ms,
		by_ms,
		in_ms,
	} as const;
};
