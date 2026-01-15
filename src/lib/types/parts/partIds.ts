import { page } from '$app/state';
import { z } from 'zod';

export let IdObjSchema = z.object({
	ms: z.number(),
	by_ms: z.number(),
	in_ms: z.number(),
});
export type IdObj = z.infer<typeof IdObjSchema>;

export let AtIdObjSchema = z.object({
	at_ms: z.number(),
	at_by_ms: z.number(),
	at_in_ms: z.number(),
});
export type AtIdObj = z.infer<typeof AtIdObjSchema>;

export let FullIdObjSchema = IdObjSchema.merge(AtIdObjSchema);
export type FullIdObj = z.infer<typeof FullIdObjSchema>;

export let idRegex = /^\d+_\d+_\d+$/;
export let idsRegex = /(?<!\S)(\d+_\d+_\d+)(?!\S)/g;
export let hasTemplateIdRegex = /\d*_\d*_\d+/;
export let templateIdRegex = /^\d*_\d*_\d+$/;

export let isTemplateId = (str = '') => templateIdRegex.test(str);
export let isIdStr = (str = '') => idRegex.test(str);
export let getIdStr = (io: IdObj) => `${io.ms}_${io.by_ms}_${io.in_ms}`;
export let getAtIdStr = (aio: AtIdObj) => `${aio.at_ms}_${aio.at_by_ms}_${aio.at_in_ms}`;

export let id0 = {
	at_ms: 0,
	at_by_ms: 0,
	at_in_ms: 0,
	ms: 0,
	by_ms: 0,
	in_ms: 0,
} satisfies FullIdObj;

export let getIdObj = (io: IdObj) => ({
	ms: io.ms,
	by_ms: io.by_ms,
	in_ms: io.in_ms,
});

export let getAtIdObj = (aio: AtIdObj) => ({
	at_ms: aio.at_ms,
	at_by_ms: aio.at_by_ms,
	at_in_ms: aio.at_in_ms,
});

export let getFullIdObj = (fio: FullIdObj) => ({
	at_ms: fio.at_ms,
	at_by_ms: fio.at_by_ms,
	at_in_ms: fio.at_in_ms,
	ms: fio.ms,
	by_ms: fio.by_ms,
	in_ms: fio.in_ms,
});

export let getAtIdObjAsIdObj = (aio: AtIdObj) => ({
	ms: aio.at_ms,
	by_ms: aio.at_by_ms,
	in_ms: aio.at_in_ms,
});

export let getIdObjAsAtIdObj = (io: IdObj) => ({
	at_ms: io.ms,
	at_by_ms: io.by_ms,
	at_in_ms: io.in_ms,
});

export let getIdStrAsIdObj = (idStr: string) => {
	let s = idStr.split('_', 3);
	let ms = +s[0];
	let by_ms = +s[1];
	let in_ms = +s[2];
	if (
		!s[0] ||
		!s[1] ||
		!s[2] || //
		!Number.isInteger(ms) ||
		!Number.isInteger(by_ms) ||
		!Number.isInteger(in_ms)
	)
		throw new Error(`invalid idStr`);
	return {
		ms,
		by_ms,
		in_ms,
	} as const;
};

export let getIdStrAsAtIdObj = (idStr: string) => {
	let s = idStr.split('_', 3);
	let at_ms = +s[0];
	let at_by_ms = +s[1];
	let at_in_ms = +s[2];
	if (
		!s[0] ||
		!s[1] ||
		!s[2] ||
		!Number.isInteger(at_ms) ||
		!Number.isInteger(at_by_ms) ||
		!Number.isInteger(at_in_ms)
	)
		throw new Error(`invalid idStr`);
	return {
		at_ms,
		at_by_ms,
		at_in_ms,
	} as const;
};

export let getUrlInMs = () => {
	let tid = isIdStr(page.state.postIdStr)
		? page.state.postIdStr //
		: page.params.tid;
	return tid ? +tid.split('_', 3)[2] : undefined;
};
