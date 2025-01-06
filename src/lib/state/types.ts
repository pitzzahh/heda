import { SettingsState } from '@/hooks/settings-state.svelte';
import { UndoRedoState } from '@/hooks/undo-redo.svelte';
export type State =
	| MainState
	| RouteState
	| DialogState
	| CountState
	| MiscState
	| SettingsState
	| UndoRedoState;

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

export type MiscState = {
	form_data?: {
		data?: unknown;
		label?: string;
	};
};
