import type { Load } from "@/types/load";

export type Panel = {
  id: number;
  name: string;
  loads?: Load[];
}