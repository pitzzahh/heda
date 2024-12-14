import type { default_load_types, default_terminal_temperatures } from "@/constants";
import type { Node } from "@/db/schema";

// has to put required since load_data in NodeDocType is optional
export type Load = Required<NonNullable<Node["load_data"]>>;

export type VariesLabel = 'Unit Wattage' | 'Unit Load' | 'Horsepower Rating' | 'Current Rating';

export type LoadType = (typeof default_load_types)[keyof typeof default_load_types];

export type TerminalTemperature = (typeof default_terminal_temperatures)[keyof typeof default_terminal_temperatures];

export type DefaultLoad = {
  description: string;
  varies: string;
  continuous: boolean;
  type: LoadType;
}