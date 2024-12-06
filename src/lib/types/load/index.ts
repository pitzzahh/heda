export type LoadType = "DEFAULT" | 'CUSTOM';

export type Load = {
  id: string;
  load_description: string;
  quantity: number;
  varies: number;
  is_panel: number;
  continuous: number;
  special: string;
  loads?: Load[];
};

// ini pete su gagamiton tang type duman sa mga panel na hali sa db
export type LoadLatest = {
  load_description: string;
  quantity: number;
  varies: number;
  continuous: number;
  special: string;
};