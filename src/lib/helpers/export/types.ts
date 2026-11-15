export type ExportProcessResult = {
	valid: boolean;
	message?: string;
	is_system_error?: boolean;
	description?: string;
};

export type Header = { text: string; cols: number; subText?: string; sub_cols?: string[] };
