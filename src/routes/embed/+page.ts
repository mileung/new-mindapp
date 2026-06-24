import type { Post } from '$lib/types/posts';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	return {
		post: {
			history: null,
			// rxnEmojiCount:
		} satisfies Post,
	};
};
