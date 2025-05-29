import type { SelectThought } from '$lib';

export function getThoughtId(thought: SelectThought) {
	return `${thought.ms}_${thought.by_id || ''}`;
}
