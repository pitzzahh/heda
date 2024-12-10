import type { default_load_types } from "@/constants";
import type { NodeDocType } from "@/db/schema";

// has to put required since load_data in NodeDocType is optional
export type Load = Required<NonNullable<NodeDocType["load_data"]>>;

export type LoadType = (typeof default_load_types)[keyof typeof default_load_types];

export type DefaultLoad = {
  description: string;
  varies: number;
  continuous: boolean;
  type: LoadType;
}