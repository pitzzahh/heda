import { PersistedState } from 'runed';
import { setState, getState } from '@/state/index.svelte';
import { PROJECT_STATE_CTX } from '@/state/constants';
import { exists, FileHandle } from '@tauri-apps/plugin-fs';

type RecentProject = {
  id: string;
  project_name?: string;
  project_path: string;
  exists: boolean;
}

type ProjectStateType = {
  recent_projects?: RecentProject[]
}

export class ProjectState {
  private persisted_state: PersistedState<ProjectStateType>;

  recent_projects = $state<RecentProject[]>();
  current_file = $state<FileHandle>();
  id = $state('')
  current_project_name = $state<string | undefined>(undefined);
  current_project_path = $state('');
  exists = $state(false)

  constructor(recent_project?: RecentProject) {
    const _persisted_state = new PersistedState<ProjectStateType>('project_state', {
      recent_projects: []
    });
    this.persisted_state = _persisted_state;
    this.validateRecentProjects();
    recent_project && this.addRecentProject(recent_project);
  }

  addRecentProject(recent_project: RecentProject, set_as_current: boolean = true) {
    const { id, project_name, project_path, exists } = recent_project;
    this.persisted_state.current.recent_projects?.push(recent_project);
    this.recent_projects = this.persisted_state.current.recent_projects;
    if (set_as_current) {
      this.id = id;
      this.current_project_name = project_name;
      this.current_project_path = project_path;
      this.exists = exists;
    }
  }

  removeRecentProject(project_name: string) {
    this.persisted_state.current.recent_projects = this.persisted_state.current.recent_projects?.filter(project => project.project_name !== project_name);
    this.recent_projects = this.persisted_state.current.recent_projects;
  }

  setCurrentProject(current_project: RecentProject) {
    this.current_project_name = current_project.project_name;
    this.current_project_path = current_project.project_path;
    this.exists = current_project.exists;
  }

  updateProject(project_id: string, new_project: Partial<RecentProject>) {
    const project = this.persisted_state.current.recent_projects?.find(project => project.id === project_id);
    if (project) {
      this.current_project_name = new_project.project_name;
      if (new_project.project_path) this.current_project_path = new_project.project_path;
      this.exists = project.exists;
      this.persisted_state.current = {
        ...this.persisted_state.current,
        recent_projects: this.persisted_state.current.recent_projects?.map(project => {
          if (project.id === project_id) {
            return {
              ...project,
              ...new_project
            }
          }
          return project;
        })
      }
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

  async setCurrentFile(file: FileHandle) {
    this.current_file = file;
    return this.current_file;
  }

  async closeCurrentFile() {
    await this.current_file?.close();
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
