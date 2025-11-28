type HasDuplicates<T extends readonly unknown[]> = T extends readonly [infer First, ...infer Rest]
	? First extends Rest[number]
		? First
		: HasDuplicates<Rest>
	: never;

let uniqueArray = <const T extends readonly unknown[]>(
	arr: HasDuplicates<T> extends never ? T : never,
): T => {
	return arr;
};

export let reactionList = uniqueArray([
	'😂',
	'👍',
	'👀',
	'❤️',
	//
	'✅',
	'❌',
	'💯',
	'🎉',
	'🔥',
	'👋',
	'👏',
	'🙏',
	'🙌',
	'🤝',
	'💪',
	'🤗',
	'🤔',
	'🤓',
	'😎',
	'🤤',
	'😅',
	'😢',
	'😏',
	'😐',
	'😔',
	'😬',
	'😴',
	'😷',
	'😜',
	'😤',
	'🤩',
	'😇',
	'😱',
	'🤮',
	'🤯',
	'😡',
	'😈',
	'🤡',
]);
