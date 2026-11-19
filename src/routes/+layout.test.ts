import { describe, expect, it } from 'vitest';
import { load } from './+layout.js';
import { getCurrentProject } from '#lib/db/queries/index.js';

describe('root layout load', () => {
	it('initializes the database before first render', async () => {
		await expect(load()).resolves.toBeUndefined();
		expect(getCurrentProject()).toBeUndefined();
	});
});
