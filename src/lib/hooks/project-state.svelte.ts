import { PersistedState } from 'runed';
import { setState, getState } from '@/state/index.svelte';
import { PROJECT_STATE_CTX } from '@/state/constants';
import { exists, BaseDirectory } from '@tauri-apps/plugin-fs';


type RecentProject = {
  project_name: string;
  project_path: string;
  exists?: boolean;
}
type ProjectStateType = {
  recent_projects?: RecentProject[]
}

export class ProjectState {
  private persisted_state: PersistedState<ProjectStateType>;

  recent_projects = $state<RecentProject[]>()
  current_project_name = $state('Untitled');
  current_project_path = $state('');

  constructor(recent_project?: RecentProject) {
    const _persisted_state = new PersistedState<ProjectStateType>('project_state', {
      recent_projects: []
    });
    this.persisted_state = _persisted_state;
    this.validateRecentProjects();
    recent_project && this.addRecentProject(recent_project?.project_name, recent_project?.project_path);
  }

  addRecentProject(project_name: string, project_path: string) {
    this.persisted_state.current.recent_projects?.push({ project_name, project_path });
    this.recent_projects = this.persisted_state.current.recent_projects;
    this.current_project_name = project_name;
    this.current_project_path = project_path;
  }

  removeRecentProject(project_name: string) {
    this.persisted_state.current.recent_projects = this.persisted_state.current.recent_projects?.filter(project => project.project_name !== project_name);
    this.recent_projects = this.persisted_state.current.recent_projects;
  }

  private async validateRecentProjects() {
    this.persisted_state.current.recent_projects = await Promise.all(
      this.persisted_state.current.recent_projects?.map(async (project) => {
        project.exists = await exists(project.project_path);
        return project;
      }) || []
    );
  }

}
export function setProjectState() {
  return setState(new ProjectState(), PROJECT_STATE_CTX);
}

export function getProjectState() {
  return getState<ProjectState>(PROJECT_STATE_CTX);
}
