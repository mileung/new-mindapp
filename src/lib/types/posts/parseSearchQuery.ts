import { day, getMonthLength, getYearLength, hour, minute, second } from '$lib/time';
import { z } from 'zod';
import { getIdStrAsIdObj, IdObjSchema } from '../parts/partIds';

let parseDateParts = (
	year = 0,
	month = 0,
	day = 0,
	hour = 0,
	minute = 0,
	second = 0,
	millisecond = 0,
) => {
	let date = new Date(
		year,
		(month || 1) - 1, // new Date uses months 0-11, not 1-12
		day,
		hour,
		minute,
		second,
		millisecond,
	);
	return isNaN(date.getTime()) ? 0 : date.getTime();
};

export let ParsedSearchSchema = z.object({
	tagsInclude: z.array(z.string()),
	tagsExclude: z.array(z.string()),
	coreIncludes: z.array(z.string()),
	coreExcludes: z.array(z.string()),
	msBefore: z.number().optional(),
	msAfter: z.number().optional(),
	byMssInclude: z.array(z.number()),
	byMssExclude: z.array(z.number()),
	inMssInclude: z.array(z.number()),
	inMssExclude: z.array(z.number()),
	postIdObjsInclude: z.array(IdObjSchema),
	postIdObjsExclude: z.array(IdObjSchema),
});

export type ParsedSearch = z.infer<typeof ParsedSearchSchema>;

export let parseSearchQuery = (query = '') => {
	let result: ParsedSearch = {
		tagsInclude: [],
		tagsExclude: [],
		coreIncludes: [],
		coreExcludes: [],
		msBefore: undefined,
		msAfter: undefined,
		byMssInclude: [],
		byMssExclude: [],
		inMssInclude: [],
		inMssExclude: [],
		postIdObjsInclude: [],
		postIdObjsExclude: [],
	};

	while (query) {
		// e.g. [tag] or -[tag]
		let tagMatch = query.match(/^-?\[([^\]]+)\]/);
		if (tagMatch) {
			(tagMatch[0][0] === '-'
				? result.tagsExclude //
				: result.tagsInclude
			).push(tagMatch[1]);
			query = query.slice(tagMatch[0].length);
			continue;
		}

		// e.g. "phrase" or -"phrase"
		let coreMatch = query.match(/^-?"([^"]+)"/);
		if (coreMatch) {
			(coreMatch[0][0] === '-'
				? result.coreExcludes //
				: result.coreIncludes
			).push(coreMatch[1]);
			query = query.slice(coreMatch[0].length);
			continue;
		}

		// e.g. 0_0_0 -123_235345_1
		let idMatch = query.match(/^-?(\d+_\d+_\d+)/);
		if (idMatch) {
			let idObj = getIdStrAsIdObj(idMatch[1]);
			(idMatch[0][0] === '-' //
				? result.postIdObjsExclude
				: result.postIdObjsInclude
			).push(idObj);
			query = query.slice(idMatch[0].length);
			continue;
		}

		let msMatch = query.match(/^ms(=|<=?|>=?)([0-9]+)/);
		if (msMatch) {
			let num = parseInt(msMatch[2]);
			if (msMatch[1] === '=' && result.msBefore === undefined && result.msAfter === undefined) {
				result.msAfter = num - 1; // ms=
				result.msBefore = num + 1;
			} else if (msMatch[1][0] === '<' && result.msBefore === undefined) {
				result.msBefore = num + (msMatch[1][1] === '=' ? 1 : 0); // ms< or ms<=
			} else if (msMatch[1][0] === '>' && result.msAfter === undefined) {
				result.msAfter = num - (msMatch[1][1] === '=' ? 1 : 0); // ms> or ms>=
			}
			query = query.slice(msMatch[0].length);
			continue;
		}

		// e.g. date=2020 or date=2020-12-03 or date=2020-12-3-6-07-42-888 from year to millisecond
		// e.g. date<[date string like for date=...] or date<=[date string like for date=...]
		// e.g. date>[date string like for date=...] or date>=[date string like for date=...]
		let dateMatch = query.match(/^date(=|<=?|>=?)([\d\-]+)/);
		if (dateMatch) {
			let operator = dateMatch[1];
			let parts = dateMatch[2].split('-').map((s) => parseInt(s));

			if (operator === '=' && result.msBefore === undefined && result.msAfter === undefined) {
				result.msAfter = parseDateParts(...parts, ...[0, 1, 1, 0, 0, 0, 0].slice(parts.length)) - 1;
				result.msBefore =
					parseDateParts(
						...parts,
						...[
							0, //
							12,
							new Date(parts[0], parts[1] || 12, 0).getDate(),
							23,
							59,
							59,
							999,
						].slice(parts.length),
					) + 1;
			} else if (operator[0] === '<' && result.msBefore === undefined) {
				result.msBefore =
					parseDateParts(
						...parts, //
						...[0, 1, 1, 0, 0, 0, 0].slice(parts.length),
					) +
					(operator[1] === '='
						? [
								0,
								getYearLength(parts[0]),
								getMonthLength(parts[0], parts[1]),
								day,
								hour,
								minute,
								second,
								1,
							][parts.length]
						: 0);
			} else if (operator[0] === '>' && result.msAfter === undefined) {
				result.msAfter =
					parseDateParts(
						...parts,
						...[
							0, //
							12,
							new Date(parts[0], parts[1] || 12, 0).getDate(),
							23,
							59,
							59,
							999,
						].slice(parts.length),
					) -
					(operator[1] === '='
						? [
								0,
								getYearLength(parts[0]),
								getMonthLength(parts[0], parts[1]),
								day,
								hour,
								minute,
								second,
								1,
							][parts.length]
						: 0);
			}
			query = query.slice(dateMatch[0].length);
			continue;
		}

		// e.g. by_ms:123 or -by_ms:456
		// e.g. in_ms:789 or -in_ms:123
		let byMsInMsMatchMatch = query.match(/^-?(by|in)_ms:(\d+)/);
		if (byMsInMsMatchMatch) {
			let by = byMsInMsMatchMatch[1] === 'by';
			let num = parseInt(byMsInMsMatchMatch[2]);
			(byMsInMsMatchMatch[0][0].startsWith('-')
				? by
					? result.byMssExclude
					: result.inMssExclude
				: by
					? result.byMssInclude
					: result.inMssInclude
			).push(num);
			query = query.slice(byMsInMsMatchMatch[0].length);
			continue;
		}

		let spaceIndex = query.indexOf(' ');
		if (spaceIndex === -1) {
			result.coreIncludes.push(query);
			break;
		}
		if (spaceIndex) result.coreIncludes.push(query.slice(0, spaceIndex));
		query = query.slice(spaceIndex + 1).trimStart();
	}

	return result;
};

// console.log(
// 	parseSearchQuery(
// 		`[music] -[spam] "good post" -"bad phrase" date<2024-01-01 date>2024-01-01 by_ms:123 -by_ms:456 in_ms:789 -in_ms:101`,
// 	),
// );
// console.log(parseSearchQuery(`[tag 1] -[not tag 2]   -[  234234]    `).msBefore);
// console.log(
// 	'ms',
// 	parseSearchQuery(`date=2023-4-01-0-0-0-0`).msBefore - //
// 		parseSearchQuery(`date=2023-4-01-0-0-0-0`).msAfter,
// );

// console.log(
// 	'day',
// 	parseSearchQuery(`date=2023-4-01`).msBefore -
// 		parseSearchQuery(`date=2023-4-01`).msAfter - //
// 		day,
// 	parseSearchQuery(`date=2023-4-01`),
// );
// console.log('msAfter', new Date(parseSearchQuery(`date=2023-4-01`).msAfter));
// console.log('msBefore', new Date(parseSearchQuery(`date=2023-4-01`).msBefore));

// console.log(
// 	'month',
// 	parseSearchQuery(`date=2022-1`).msBefore -
// 		parseSearchQuery(`date=2022-1`).msAfter - //
// 		31 * day,
// );
// console.log(
// 	'year',
// 	parseSearchQuery(`date=2021`).msBefore - //
// 		parseSearchQuery(`date=2021`).msAfter -
// 		year,
// );
// console.log(parseSearchQuery(`date<=2024-01-01`).msBefore);
// console.log(parseSearchQuery(`date<2024-01-02`).msBefore);

// console.log(parseSearchQuery(`ms=2`));
// console.log(parseSearchQuery(`ms<12`));
// console.log(parseSearchQuery(`ms<=123`));
// console.log(parseSearchQuery(`ms>12`));
// console.log(parseSearchQuery(`ms>=123`));
// console.log(parseSearchQuery(`date<2000`));
// console.log(parseSearchQuery(`date<2000`));
// console.log(parseSearchQuery(`date<=2000`));
// console.log(parseSearchQuery(`date<2001`));
// console.log(parseSearchQuery(`date<=2001`));
// console.log(parseSearchQuery(`date=2000-2`));
// console.log(parseSearchQuery(`date>1999`));
// console.log(parseSearchQuery(`date>=1999`));
// console.log(parseSearchQuery(`1769812970345_1769809883559_1`));
