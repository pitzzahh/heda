import type { NodeDocType } from '@/db/schema';

// has to put required since panel_data in NodeDocType is optional
export type Panel = Required<NonNullable<NodeDocType["panel_data"]>>;

// ini pete su gagamiton tang type duman sa mga panel na hali sa db
export type PanelLatest = {
	name: string;
	circuit_number: number;
	ambient_temperature: string;
	phase: string;
};
