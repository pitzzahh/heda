import type { Project, Node } from "@/db/schema";

export type MainPrompt = {
  new_file: boolean;
  load_file: boolean;
}

export type FileExport = {
  project: Project;
  nodes: Node[]
}

export type RecentProject = {
  id: string;
  project_name: string;
  project_path: string;
  exists: boolean;
}