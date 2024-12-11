import type { default_load_types, default_terminal_temperatures } from "@/constants";
import type { NodeDocType } from "@/db/schema";

// has to put required since load_data in NodeDocType is optional
export type Load = Required<NonNullable<NodeDocType["load_data"]>>;

export type VariesLabel = 'Unit Wattage' | 'Unit Load' | 'Horsepower Rating' | 'Current Rating';

export type LoadType = (typeof default_load_types)[keyof typeof default_load_types];

export type TerminalTemperature = (typeof default_terminal_temperatures)[keyof typeof default_terminal_temperatures];

export type DefaultLoad = {
  description: string;
  varies: number;
  continuous: boolean;
  type: LoadType;
}