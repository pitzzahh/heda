/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Load } from '@/types/load';
import { LocalStorage } from './storage.svelte';
import type { Panel } from '@/types/panel';
import { getContext, setContext } from 'svelte';

type Project = {
	highest_unit_form: any;
	tree: Panel[];
};

export class ProjectState {
	private localStorage = new LocalStorage<Project>('project');
	storedProjectData = this.localStorage.current;
	project = $state<Project | null>(this.localStorage.current || null);

	constructor() {}

	private updateProjectData(updatedData: Project) {
		this.storedProjectData = updatedData;
		this.project = updatedData;
	}

	createProject(highestUnitFormData: any) {
		this.storedProjectData = { highest_unit_form: highestUnitFormData, tree: [] };
		this.project = { highest_unit_form: highestUnitFormData, tree: [] };
	}

	addPanel(panel: Panel) {
		const updatedData = {
			...this.storedProjectData,
			tree: [...this.storedProjectData.tree, panel]
		};
		this.updateProjectData(updatedData);
	}


    // UNI NA TIG CHATGPT KO DAE KO PA NA TRY
    
	// Add a load to the specified panel or recursively to a load
	addLoad(targetId: number | string, loadData: Load) {
		const updatedTree = this.addLoadToTree(this.storedProjectData.tree, targetId, loadData);
		if (!updatedTree) {
			throw new Error(`Target with ID ${targetId} not found.`);
		}
		const updatedData: Project = {
			...this.storedProjectData,
			tree: updatedTree
		};
		this.updateProjectData(updatedData);
	}

	// Recursive function to add a load at any depth
	private addLoadToTree(tree: Panel[], targetId: number | string, loadData: Load): Panel[] | null {
		let updatedTree = false;

		const newTree = tree.map((panel) => {
			if (panel.id === targetId) {
				updatedTree = true;
				return {
					...panel,
					loads: panel.loads ? [...panel.loads, loadData] : [loadData]
				};
			}
			if (panel.loads) {
				const updatedLoads = this.addLoadToTree(panel.loads as any as Panel[], targetId, loadData);
				if (updatedLoads) {
					updatedTree = true;
					return { ...panel, loads: updatedLoads };
				}
			}
			return panel;
		});
		return updatedTree ? newTree : (null as any);
	}
}

export function setProjectState() {
	return setContext('PROJECT_STATE_CTX', new ProjectState());
}

export function getProjectState() {
	return getContext<ReturnType<typeof setProjectState>>('PROJECT_STATE_CTX');
}
