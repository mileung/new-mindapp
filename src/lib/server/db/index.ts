import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

const client = createClient(
	dev
		? {
				url: 'file:global-test.db',
			}
		: {
				url: env.DATABASE_URL!,
				authToken: env.DATABASE_AUTH_TOKEN!,
			},
);

export let tdb = drizzle(client, { schema });

export let tdbInsertParts = tdb.insert(schema.partsTable).values;
export let tdbPartsWhere = tdb.select().from(schema.partsTable).where;
export let tdbDeletePartsWhere = tdb.delete(schema.partsTable).where;
export let tdbUpdateParts = tdb.update(schema.partsTable).set;
