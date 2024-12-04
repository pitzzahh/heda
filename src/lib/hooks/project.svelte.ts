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
	// localStorage.current = this.localStorage.current;
	project = $state<Project | null>(this.localStorage.current || null);

	constructor() {}

	private updateProjectData(updatedData: Project) {
		this.localStorage.current = updatedData;
		this.project = updatedData;
	}

	createProject(highestUnitFormData: any) {
		console.log(highestUnitFormData);
		this.localStorage.current = { highest_unit_form: highestUnitFormData, tree: [] };
		this.project = { highest_unit_form: highestUnitFormData, tree: [] };
	}

	addPanel(panel: Panel) {
		const updatedData = {
			...this.localStorage.current,
			tree: [...this.localStorage.current.tree, panel]
		};
		this.updateProjectData(updatedData);
	}

	// UNI NA TIG CHATGPT KO DAE KO PA NA TRY

	// Add a load to the specified panel or recursively to a load
	addLoad(targetId: number | string, loadData: Load) {
		const updatedTree = this.addLoadToTree(this.localStorage.current.tree, targetId, loadData);
		if (!updatedTree) {
			throw new Error(`Target with ID ${targetId} not found.`);
		}
		const updatedData: Project = {
			...this.localStorage.current,
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

const key = Symbol.for('PROJECT_STATE_CTX');

export function setProjectState() {
	return setContext(key, new ProjectState());
}

export function getProjectState() {
	return getContext<ReturnType<typeof setProjectState>>(key);
}
