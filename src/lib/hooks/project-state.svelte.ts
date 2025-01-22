import { PersistedState } from 'runed';
import { setState, getState } from '@/state/index.svelte';
import { PROJECT_STATE_CTX } from '@/state/constants';
import { exists } from '@tauri-apps/plugin-fs';
import type { RecentProject } from '@/types/main';

type ProjectStateType = {
  recent_projects?: RecentProject[],
  loaded: boolean,
  current_project?: RecentProject
}

export class ProjectState {
  private persisted_state: PersistedState<ProjectStateType>;

  recent_projects = $state<RecentProject[]>();
  id = $state('')
  current_project_name = $state<string | undefined>(undefined);
  current_project_path = $state('');
  exists = $state(false)
  loaded = $state(false)

  constructor(recent_project?: RecentProject) {
    const _persisted_state = new PersistedState<ProjectStateType>('project_state', {
      recent_projects: [],
      loaded: false,
      current_project: undefined
    });
    this.persisted_state = _persisted_state;
    this.validateRecentProjects();
    this.setProjectLoaded(this.persisted_state.current.loaded);
    this.recent_projects = this.persisted_state.current.recent_projects;
    recent_project && this.addRecentProject(recent_project);
  }

  addRecentProject(recent_project: RecentProject, set_as_current: boolean = false) {
    this.persisted_state.current.recent_projects?.push(recent_project);
    this.recent_projects = this.persisted_state.current.recent_projects;
    if (set_as_current) {
      this.setCurrentProject(recent_project);
    }
  }

  removeRecentProject(project_id: string, remove_current: boolean = false) {
    this.persisted_state.current.recent_projects = this.persisted_state.current.recent_projects?.filter(project => project.id !== project_id);
    this.recent_projects = this.persisted_state.current.recent_projects;
    if (remove_current) {
      this.id = '';
      this.current_project_name = '';
      this.current_project_path = '';
      this.exists = false;
      this.recent_projects = this.persisted_state.current.recent_projects;
    }
  }

  setCurrentProject(current_project: RecentProject) {
    this.persisted_state.current.current_project = current_project;
    this.id = current_project.id;
    this.current_project_name = current_project.project_name;
    this.current_project_path = current_project.project_path;
    this.exists = current_project.exists;
  }

  setProjectLoaded(loaded: boolean) {
    this.persisted_state.current.loaded = loaded;
    this.loaded = loaded;
  }

  updateProject(project_id: string, new_project: Partial<RecentProject>, update_current: boolean = false) {
    const projectIndex = this.persisted_state.current.recent_projects?.findIndex(project => project.id === project_id);
    if (projectIndex !== -1 && projectIndex !== undefined && this.persisted_state.current.recent_projects) {
      const updatedProject = {
        ...this.persisted_state.current.recent_projects[projectIndex],
        ...new_project
      };
      this.persisted_state.current.recent_projects[projectIndex] = updatedProject;
      this.recent_projects = this.persisted_state.current.recent_projects;

      if (update_current) {
        this.setCurrentProject(updatedProject);
      }
      console.log(`Project updated: ${JSON.stringify(updatedProject)}`);
      console.log(`Recent projects: ${JSON.stringify(this.recent_projects)}`);
      console.log(`Persisted state: ${JSON.stringify(this.persisted_state.current)}`);
    }
  }

  geCurrentProject(project_id?: string): RecentProject | undefined {
    // if project id, get from the recent_projects, else get the current fields
    if (project_id) {
      return this.persisted_state.current.recent_projects?.find(project => project.id === project_id);
    }
    return {
      id: this.id,
      project_name: this.current_project_name,
      project_path: this.current_project_path,
      exists: this.exists
    }
  }

  async validateRecentProjects() {
    this.persisted_state.current.recent_projects = await Promise.all(
      this.persisted_state.current.recent_projects?.map(async (project) => {
        project.exists = await exists(project.project_path);
        return project;
      }) || []
    );
  }

}
export function setProjectState(recent_project?: RecentProject) {
  return setState(new ProjectState(recent_project), PROJECT_STATE_CTX);
}

export function getProjectState() {
  return getState<ProjectState>(PROJECT_STATE_CTX);
}
