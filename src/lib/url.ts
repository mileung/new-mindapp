import { goto } from '$app/navigation';
import { z } from 'zod';

const ParamsSchema = z.object({
	omegle: z.boolean().optional(),
	strTest: z.string().optional(),
	numTest: z.number().optional(),
});

type Params = z.infer<typeof ParamsSchema>;

export function updateSearchParams(params: Params) {
	const currentUrl = new URL(window.location.href);
	const searchParams = currentUrl.searchParams;
	Object.entries(params).forEach(([key, value]) => {
		if (value === undefined) {
			searchParams.delete(key);
		} else {
			searchParams.set(key, String(value));
		}
	});
	goto(currentUrl.toString(), {
		replaceState: true,
		noScroll: true,
	});
}

export function getSearchParams(): Params {
	const searchParams = new URLSearchParams(window.location.search);
	const result: Record<string, any> = {};
	for (const [key, value] of searchParams.entries()) {
		// @ts-ignore
		let typeName = ParamsSchema.shape[key]._def.typeName;
		if (typeName === 'ZodOptional') {
			// @ts-ignore
			typeName = ParamsSchema.shape[key]._def.innerType._def.typeName;
		}
		switch (typeName) {
			case 'ZodBoolean':
				result[key] =
					value.toLowerCase() === 'true'
						? true
						: value.toLowerCase() === 'false'
							? false
							: undefined;
				break;
			case 'ZodNumber':
				result[key] = !isNaN(Number(value)) ? Number(value) : undefined;
				break;
			case 'ZodString':
				result[key] = value || undefined;
				break;
		}
	}
	return result as Params;
}
