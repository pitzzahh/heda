import { describe, expect, it } from 'vitest';
import { engine, engineFile } from './api.js';

const project = { id: 'p', root_node_id: 'root', settings: {} };
const nodes = [
	{
		id: 'root',
		node_type: 'root',
		highest_unit_form: { distribution_unit: 'Utility Service', phase: 'one_phase' }
	}
];

describe('engineFile', () => {
	it('starts after every engine call made before it', async () => {
		// Not awaited: the file must still see this project.
		const opened = engine('open', { project, nodes });
		const pdf = await engineFile('sheet_set', { project_name: 'Test', date: '2026-11-20' });
		await opened;
		expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe('%PDF-');
	});

	it('rejects an unknown file command', async () => {
		await expect(engineFile('nope')).rejects.toThrow('unknown file command');
	});
});
