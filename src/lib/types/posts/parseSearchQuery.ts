import { z } from 'zod';
import { getIdStrAsIdObj, IdObjSchema } from '../parts/partIds';

export let searchGuideArr = [
	{
		title: 'Basic',
		syntax: [
			['[...]', 'Posts with a tag called "..."'],
			['"..."', 'Posts with a core containing "..." (quotes optional)'],
		],
		examples: [
			['[Movie][Documentary]', 'Posts tagged with either "Movie" or "Documentary"'],
			['Hello world', 'Posts with a core containing either "Hello" or "world"'],
			['"Hello world"', 'Posts with a core containing "Hello world"'],
		],
	},
	{
		title: 'Regular',
		syntax: [
			['8_8_8', 'Post 8_8_8'],
			['_8_', 'Posts by account _8_'],
			['__8', 'Posts in space __8'],
		],
		examples: [
			['0_0_0 8_8_8', 'posts 0_0_0 and 8_8_8'],
			['_8_ __8', 'posts by _8_ in space __8 (and current space)'],
		],
	},
	{
		title: 'Complex',
		syntax: [
			['[... ]', 'Posts with a tag starting with "..."'],
			['[ ...]', 'Posts with a tag ending with "..."'],
			['!', 'Requires all posts to have the preceding bracketed or quoted search'],
			['{...}', 'Posts with tags starting with "...=" and ending with a number'],
			[
				'{...<888}',
				'Posts with tags starting with "...=" and ending with a number less than 888\nSupported operators: =, <, <=, >, >=',
			],
		],
		examples: [
			[
				'[ Music]! {Year>=1990}! {Year<2020}!',
				'Posts with a tag ending with "Music" and has a tag starting with "Year=" and ending with a number of at least 1990 and below 2020 (spaces optional, added for legibility)',
			],
			[
				'[Book]! [Quote]! "Lorem ipsum" "Hello world"',
				'Posts tagged with "Book" and "Quote" and has a core containing "Lorem ipsum" or "Hello world"',
			],
			[
				'[Bicycle]! {Price}! {Weight (kg)<8}!',
				'Posts tagged with "Bicycle", has a tag starting with "Price=" and ending with a number, and has a tag starting with "Weight (kg)=..." and ending with a number less than 8',
			],
		],
	},
];

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

let NumValTagComps = z.array(
	z.object({
		key: z.string(),
		rel: z.enum(['eq', 'lt', 'lte', 'gt', 'gte']),
		val: z.number(),
	}),
);

export let ParsedSearchSchema = z
	.strictObject({
		postIdObjsInclude: z.array(IdObjSchema),
		postIdObjsExclude: z.array(IdObjSchema),
		eitherByMss: z.array(z.number()),
		eitherInMss: z.array(z.number()),

		eitherTags: z.array(z.string()),
		requiredTags: z.array(z.string()),

		eitherTagStarts: z.array(z.string()),
		requiredTagStarts: z.array(z.string()),

		eitherTagEnds: z.array(z.string()),
		requiredTagEnds: z.array(z.string()),

		eitherValTagKeys: z.array(z.string()),
		requiredValTagKeys: z.array(z.string()),

		eitherNumValTagComps: NumValTagComps,
		requiredNumValTagComps: NumValTagComps,

		eitherCoreIncludes: z.array(z.string()),
		requiredCoreIncludes: z.array(z.string()),
	})
	.partial();

export type ParsedSearch = z.infer<typeof ParsedSearchSchema>;

export let parseSearchQuery = (query = '') => {
	let result: ParsedSearch = {};
	query = query.trim();
	while (query) {
		query = query.trimStart();
		if (!query) break;

		// [... ]
		let tagStartMatch = query.match(/^\[([^\]]+) \](!)?/);
		if (tagStartMatch) {
			let key = tagStartMatch[1];
			tagStartMatch[2]
				? (result.requiredTagStarts = [...(result.requiredTagStarts ?? []), key])
				: (result.eitherTagStarts = [...(result.eitherTagStarts ?? []), key]);
			query = query.slice(tagStartMatch[0].length);
			continue;
		}

		// [ ...]
		let tagEndMatch = query.match(/^\[ ([^\]]+)\](!)?/);
		if (tagEndMatch) {
			let key = tagEndMatch[1];
			tagEndMatch[2]
				? (result.requiredTagEnds = [...(result.requiredTagEnds ?? []), key])
				: (result.eitherTagEnds = [...(result.eitherTagEnds ?? []), key]);
			query = query.slice(tagEndMatch[0].length);
			continue;
		}

		// [...]
		let tagMatch = query.match(/^\[([^\]]+)\](!)?/);
		if (tagMatch) {
			let key = tagMatch[1];
			tagMatch[2]
				? (result.requiredTags = [...(result.requiredTags ?? []), key])
				: (result.eitherTags = [...(result.eitherTags ?? []), key]);
			query = query.slice(tagMatch[0].length);
			continue;
		}

		// {} e.g. {Year>=1990} {Price} {Weight (kg)<8}
		let numValTagCompMatch = query.match(
			/^\{\s*([^}=<>]+?)\s*(=|<=?|>=?)\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*\}(!)?/,
		);
		if (numValTagCompMatch) {
			let key = numValTagCompMatch[1];
			let relStr = numValTagCompMatch[2];
			let val = Number(numValTagCompMatch[3]);
			let rel: 'eq' | 'lt' | 'lte' | 'gt' | 'gte' =
				relStr === '='
					? 'eq'
					: relStr === '<'
						? 'lt'
						: relStr === '<='
							? 'lte'
							: relStr === '>'
								? 'gt'
								: 'gte';
			let comp = { key, rel, val };
			numValTagCompMatch[4]
				? (result.requiredNumValTagComps = [...(result.requiredNumValTagComps ?? []), comp])
				: (result.eitherNumValTagComps = [...(result.eitherNumValTagComps ?? []), comp]);
			query = query.slice(numValTagCompMatch[0].length);
			continue;
		}

		// {...}
		let valTagKeyMatch = query.match(/^\{([^\}]+)\}(!)?/);
		if (valTagKeyMatch) {
			let key = valTagKeyMatch[1];
			valTagKeyMatch[2]
				? (result.requiredValTagKeys = [...(result.requiredValTagKeys ?? []), key])
				: (result.eitherValTagKeys = [...(result.eitherValTagKeys ?? []), key]);
			query = query.slice(valTagKeyMatch[0].length);
			continue;
		}

		// "..."
		let coreMatch = query.match(/^"([^"]+)"(!)?/);
		if (coreMatch) {
			let phrase = coreMatch[1];
			coreMatch[2]
				? (result.requiredCoreIncludes = [...(result.requiredCoreIncludes ?? []), phrase])
				: (result.eitherCoreIncludes = [...(result.eitherCoreIncludes ?? []), phrase]);
			query = query.slice(coreMatch[0].length);
			continue;
		}

		// 8_8_8
		let postIdMatch = query.match(/^(\d+_\d+_\d+)/);
		if (postIdMatch) {
			let idObj = getIdStrAsIdObj(postIdMatch[1]);
			result.postIdObjsInclude = [...(result.postIdObjsInclude ?? []), idObj];
			query = query.slice(postIdMatch[0].length);
			continue;
		}

		// __8
		let inMsMatch = query.match(/^__(\d+)/);
		if (inMsMatch) {
			let ms = parseInt(inMsMatch[1]);
			result.eitherInMss = [...(result.eitherInMss ?? []), ms];
			query = query.slice(inMsMatch[0].length);
			continue;
		}

		// _8_
		let byMsMatch = query.match(/^_(\d+)_/);
		if (byMsMatch) {
			let ms = parseInt(byMsMatch[1]);
			result.eitherByMss = [...(result.eitherByMss ?? []), ms];
			query = query.slice(byMsMatch[0].length);
			continue;
		}

		// Unquoted word
		let spaceIndex = query.indexOf(' ');
		if (spaceIndex === -1) {
			result.eitherCoreIncludes = [...(result.eitherCoreIncludes ?? []), query];
			break;
		}
		let word = query.slice(0, spaceIndex);
		if (word) result.eitherCoreIncludes = [...(result.eitherCoreIncludes ?? []), word];
		query = query.slice(spaceIndex + 1);
	}

	return result;
};

// console.log(parseSearchQuery(`{weight (kg) < 8.88}`));
// console.log(parseSearchQuery(`{ year <= 2024 }`));
console.log(
	parseSearchQuery(
		`1_23_456 _888_ {lat<-3.08} __8 __0 _3_ {test=test} "hello world"[Book]"wow!"! test! ing  {ms=2} {ms<12}!{ms<=123} {yo>12}! {yo>=123}`,
	),
);
