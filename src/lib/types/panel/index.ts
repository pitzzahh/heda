import type { Load } from '@/types/load';

export type Panel = {
	id: number;
	name: string;
	loads?: Load[];
};


// ini pete su gagamiton tang type duman sa mga panel na hali sa db
export type PanelLatest = {
	name: string;
	circuit_number: number;
	ambient_temperature: string;
	phase: string;
};
