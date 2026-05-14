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

export let ParsedSearchSchema = z.strictObject({
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

// let searchQuery=
('[tag1][tag2][tag3]'); // posts that have tag1, tag2, and tag3
('[tag1] [tag2][tag3]'); // posts that have tag1 or tag2 and tag3
('[tag1][tag2]-[tag3]'); // posts that have tag1 and tag2 and not tag3
('lorem ipsum'); // posts whose core has "lorem" or "ipsum"
('"lorem ipsum"'); // posts whose core has "lorem ipsum"

// below are undecided
('"lorem"-"ipsum"'); // posts whose core has "lorem" and not "ipsum"
('(* Music)'); // posts with tags that end with " Music"
('(tag1=)'); // posts where tag1 === ""
('[tag1  = 1]'); // posts with tag equal to "tag1  = 1" (impossible due to normalizeTag)
('(tag1 > 0)'); // posts where tag1 > 0

// Want to search posts
// Posts consist of `tags` that are trimmed arbitrary strings (most have spaces) and `core` which is the main part of the post
// Come up with: query syntax requirements
// Minimal use of language specific keywords
// search posts that have an arbitrary set of tags
// search posts that do not have an arbitrary set of tags
// search posts that have phrases in their core
// search posts that do not have phrases in their core
// post before a certain date
// post on a certain date
// post after a certain date
// posts with tags that have a numeric component (e.g. [tag=88]) lt/eq/gt than

('[tag1][tag2] [tag3] "lorem ipsum" (yyyy<=2020) wow -"hello world" -[test] |');

('[...]'); // posts with tag called "..."
('-[...]'); // posts without tag called "..."
('888 ...'); // posts with cores containing "888" or "..."
('"888 ..."'); // posts with cores containing "888 ..."
('-"888 ..."'); // posts with cores not containing "888 ..."
('(...)'); // posts with tags starting with "...="
('(...]'); // posts with tags ending with "..."
('[...)'); // posts with tags starting with "..."
('[...] | [888] -[...]'); // posts with "..." or "888" and not "..."
('(...<888)'); // posts with tags starting with "...=" and ending with a number less than 888
// Supported operators: =, <, <=, >, >=

export let searchGuideArr = [
	{
		title: 'Simple',
		syntax: [
			['[...]', 'Posts with a tag called "..."'],
			['"..."', 'Posts with a core containing "..." (quotes optional)'],
			['_8_', 'Posts by account _8_'],
		],
		examples: [
			['[Music]', 'Posts tagged with "Music"'],
			['Hello world', 'Posts with a core containing "Hello world"'],
			[
				'[Book][Quote]"Lorem ipsum"',
				'Posts tagged with "Book" and "Quote" and has a core containing "Lorem ipsum"',
			],
		],
	},
	{
		title: 'Complex',
		syntax: [
			['[... ]', 'Posts with a tag starting with "..."'],
			['[ ...]', 'Posts with a tag ending with "..."'],
			['-[...]', 'Posts without a tag called "..."'],
			['-"..."', 'Posts with a core not containing "..."'],
			['@_8_', 'Posts at account _8_'],
			['@_8_!', 'Posts at account _8_ that account _8_ has not replied to'],
			// ['"888"|"..."', 'Group posts with a core containing "888" or "..."'],
			// ['8 8([8]|[...])', 'Posts with a core containing "8 8" and tagged with either "8" or "..."'],
			[
				'{...<888}',
				'Posts with tags starting with "...=" and ending with a number less than 888\nSupported operators: =, <, <=, >, >=',
			],
		],
		examples: [
			['[My ]-"I "', 'Posts with a tag starting with "My" and a core not containing "I "'],
			[
				'[ Music]{Year>=1990}{Year<2020}',
				'Posts with a tag ending with "Music" and has a tag starting with "Year=" and ending with a number of at least 1990 and below 2020',
			],
			[
				'[Bicycle]-[Brand=Lorem][Color=Orange]{Weight (kg)<8}',
				'Posts tagged with "Bicycle", not tagged with "Brand=Lorem", tagged with "Color=Orange", and has a tag starting with "Weight (kg)=..." and ending with a number less than 8',
			],
			// [
			// 	'[Bicycle]-[Brand=Lorem]([Color=White]|[Color=Orange]){Weight (kg)<8}',
			// 	'Posts tagged with "Bicycle", not tagged with "Brand=Lorem", tagged with either "Color=White" or "Color=Orange", and has a tag starting with "Weight (kg)=..." and ending with a number less than 8',
			// ],
		],
	},
];
