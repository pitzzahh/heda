import type { Project, Node } from "@/db/schema";

export type MainPrompt = {
  new_file: boolean;
  load_file: boolean;
}

export type FileExport = {
  project: Project;
  nodes: Node[]
}