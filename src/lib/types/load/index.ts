export type LoadType = "DEFAULT" | 'CUSTOM';

export type Load = {
  id: string,
  load_description: string;
  quantity: number;
  varies: number;
  is_panel: number;
  continuous: number;
  special: string;
}