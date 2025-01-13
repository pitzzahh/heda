import { SettingsState } from '@/hooks/settings-state.svelte';
import { UndoRedoState } from '@/hooks/undo-redo.svelte';
import { SelectNodesToDelete } from '@/hooks/select-nodes-to-delete.svelte';
import { Collapsibles } from '@/hooks/node-collapsibles.svelte';
import type { ProjectState } from '@/hooks/project-state.svelte';

export type State =
	| MainState
	| RouteState
	| DialogState
	| CountState
	| SettingsState
	| UndoRedoState
	| SelectNodesToDelete
	| ProjectState
	| Collapsibles;

export type MainState = {
	isArchiving: boolean;
	isViewingEmployee: boolean;
	processing: boolean;
};

export type RouteState = {
	currentRoute: string;
};

export type DialogState = {
	highestUnit: boolean;
	has_unsaved_changes: boolean;
};

export type CountState = {
	employeesCount: number;
	positionsCount: number;
	salariesCount: number;
	stationsCount: number;
	organizationsCount: number;
	usersCount: number;
	archivesCount: number;
	permanentEmployeesCount: number;
	resignedEmployeesCount: number;
	transferredEmployeesCount: number;
	temporaryEmployeesCount: number;
};
