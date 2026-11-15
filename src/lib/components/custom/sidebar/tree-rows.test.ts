import { describe, expect, test } from 'vitest';
import type { Node } from '#lib/types/db/index.js';
import { flattenVisibleTree } from './tree-rows.js';

function panel(id: string, parent_id: string): Node {
	return {
		id,
		node_type: 'panel',
		parent_id,
		panel_data: { name: id },
		child_ids: []
	} as unknown as Node;
}

function load(id: string, parent_id: string): Node {
	return {
		id,
		node_type: 'load',
		parent_id,
		load_data: { load_description: id },
		child_ids: []
	} as unknown as Node;
}

const root = {
	id: 'root',
	node_type: 'root',
	parent_id: null,
	child_ids: []
} as unknown as Node;

const children: Record<string, Node[]> = {
	root: [panel('p1', 'root')],
	p1: [load('l1', 'p1'), load('l2', 'p1')]
};

const base_options = {
	get_children: (parent_id: string) => children[parent_id] ?? []
};

describe('flattenVisibleTree', () => {
	test('renders only the root while it is collapsed', () => {
		const rows = flattenVisibleTree(root, {
			...base_options,
			is_expanded: () => false,
			show_loads: true
		});
		expect(rows.map((row) => row.node.id)).toEqual(['root']);
	});

	test('stops at collapsed units', () => {
		const rows = flattenVisibleTree(root, {
			...base_options,
			is_expanded: (id) => id === 'root',
			show_loads: true
		});
		expect(rows.map((row) => row.node.id)).toEqual(['root', 'p1']);
	});

	test('hides loads without hiding units', () => {
		const rows = flattenVisibleTree(root, {
			...base_options,
			is_expanded: () => true,
			show_loads: false
		});
		expect(rows.map((row) => `${row.depth}:${row.node.id}`)).toEqual(['0:root', '1:p1']);
	});

	test('includes loads at their hierarchy depth when shown', () => {
		const rows = flattenVisibleTree(root, {
			...base_options,
			is_expanded: () => true,
			show_loads: true
		});
		expect(rows.map((row) => `${row.depth}:${row.node.id}`)).toEqual([
			'0:root',
			'1:p1',
			'2:l1',
			'2:l2'
		]);
	});
});
