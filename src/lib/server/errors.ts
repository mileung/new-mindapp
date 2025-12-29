import { TRPCError } from '@trpc/server';

export let throwIf = (truthy: any) => {
	if (truthy) throw new TRPCError({ code: 'UNAUTHORIZED' });
};
