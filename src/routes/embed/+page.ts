import { id0 } from '$lib/types/parts/partIds';
import type { Post } from '$lib/types/posts';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	return {
		post: {
			...id0,
			history: null,
			// rxnEmojiCount:
		} satisfies Post,
	};
};
