import type { Phase } from "@/types/phase";
import type { LoadType } from "..";

export type MainLoad = {
  id: string;
  name: string;
  wire_length: number;
  main_ambient_temp: string;
  phase_name: Phase;
}

export type LoadDescription = {

}

export type OnePhaseLoad = {
  id: string;
  main_load: Omit<MainLoad, 'id'>;
  circuit_number: number;
  load_ambient_temp: number;
  load_type: LoadType;
}

export type OnePhaeLoadCustom = {
  id: string;
  name: string;
  wire_length: number;
  main_ambient_temp: string;
  phase_name: Phase;
}