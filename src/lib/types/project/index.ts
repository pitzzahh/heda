import type { Load } from '@/types/load';
import type { Panel } from '@/types/panel';
import type { HighestUnitSchema } from '@/schema';
import type { ProjectDocType } from '@/db/schema'
export type Project = ProjectDocType;

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
