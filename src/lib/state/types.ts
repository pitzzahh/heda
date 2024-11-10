export type State =
	| MainState
	| RouteState
	| DialogState
	| CountState

export type MainState = {
	isArchiving: boolean;
	isViewingEmployee: boolean;
	processing: boolean;
};

export type RouteState = {
	currentRoute: string;
};

export type DialogState = {
	logoutDialogOpen: boolean;
	openNav: boolean;
	totpDialogOpen: boolean;
	openPermissionsSelect: boolean;
	openSettings: boolean;
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
