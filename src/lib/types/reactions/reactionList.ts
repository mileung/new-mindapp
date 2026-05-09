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

export let shortReactionList = uniqueArray([
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
]) as string[];

// https://emojipedia.org/smileys
export let fullReactionList = [
	{
		title: '😃 Smileys',
		subs: [
			{
				subtitle: 'Smiling & Affectionate',
				emojis: [
					'😀',
					'😃',
					'😄',
					'😁',
					'😆',
					'😅',
					'🤣',
					'😂',
					'🙂',
					'😉',
					'😊',
					'😇',
					'🥰',
					'😍',
					'🤩',
					'😘',
					'😗',
					'☺️',
					'😚',
					'😙',
					'🥲',
					'😏',
				],
			},
			{
				subtitle: 'Tongues, Hands & Accessories',
				emojis: [
					'😋',
					'😛',
					'😜',
					'🤪',
					'😝',
					'🤑',
					'🤗',
					'🤭',
					'🫢',
					'🫣',
					'🤫',
					'🤔',
					'🫡',
					'🤤',
					'🤠',
					'🥳',
					'🥸',
					'😎',
					'🤓',
					'🧐',
				],
			},
			{
				subtitle: 'Neutral & Skeptical',
				emojis: [
					'🙃',
					'🫠',
					'🤐',
					'🤨',
					'😐',
					'😑',
					'😶',
					'🫥',
					'😶‍🌫️',
					'😒',
					'🙄',
					'😬',
					'😮‍💨',
					'🤥',
					'🫨',
					'🙂‍↔️',
					'🙂‍↕️',
				],
			},
			{
				subtitle: 'Sleepy & Unwell',
				emojis: [
					'😌',
					'😔',
					'😪',
					'😴',
					'🫩',
					'😷',
					'🤒',
					'🤕',
					'🤢',
					'🤮',
					'🤧',
					'🥵',
					'🥶',
					'🥴',
					'😵',
					'😵‍💫',
					'🤯',
					'🥱',
				],
			},
			{
				subtitle: 'Concerned & Negative',
				emojis: [
					'😕',
					'🫤',
					'😟',
					'🙁',
					'☹️',
					'😮',
					'😯',
					'😲',
					'😳',
					'🫪',
					'🥺',
					'🥹',
					'😦',
					'😧',
					'😨',
					'😰',
					'😥',
					'😢',
					'😭',
					'😱',
					'😖',
					'😣',
					'😞',
					'😓',
					'😩',
					'😫',
					'😤',
					'😡',
					'😠',
					'🤬',
				],
			},
			{
				subtitle: 'Costume, Creature & Animal',
				emojis: [
					'😈',
					'👿',
					'💀',
					'☠️',
					'💩',
					'🤡',
					'👹',
					'👺',
					'👻',
					'👽',
					'👾',
					'🤖',
					'😺',
					'😸',
					'😹',
					'😻',
					'😼',
					'😽',
					'🙀',
					'😿',
					'😾',
					'🙈',
					'🙉',
					'🙊',
				],
			},
		],
	},
];

// '🧑 People'

// '🐻 Animals & Nature'

// '🍔 Food & Drink'

// '⚽ Activity'

// '🚀 Travel & Places'

// '💡 Objects'

// '💕 Symbols'

// '🎌 Flags'
