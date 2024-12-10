import type { Load } from '../load';
import type { Panel } from '../panel';
import type { HighestUnitSchema } from '@/schema';

export type Project = {
	id: string;
	highest_unit_form: HighestUnitSchema;
	tree: string[];
	project_name: string;
};

export type Node = {
	id: string;
	load_data?: Load;
	panel_data?: Panel;
	highest_unit_form?: HighestUnitSchema;
	circuit_number?: number;
	parent_id: string | null;
	child_ids: string[];
	node_type: 'load' | 'panel' | 'root';
};
