<script lang="ts" module>
	import type { ColumnDef } from '@tanstack/table-core';

	type Row = { id: string; name: string; value: number };

	const ROW_COUNT = 200;

	const columns: ColumnDef<Row, string | number>[] = [
		{ accessorKey: 'name', header: 'Name' },
		{ accessorKey: 'value', header: 'Value' }
	];
</script>

<script lang="ts">
	import { DataTable } from './index.js';
	import { setUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';
	import { setSettingsState } from '#lib/hooks/settings-state.svelte.js';
	import { setSelectNodesToDeleteState } from '#lib/hooks/select-nodes-to-delete.svelte.js';

	setSettingsState('dark');
	setUndoRedoState();
	setSelectNodesToDeleteState();

	const data: Row[] = Array.from({ length: ROW_COUNT }, (_, index) => ({
		id: `row-${index}`,
		name: `Row ${index}`,
		value: index
	}));
</script>

<DataTable {data} {columns} is_footer_shown={false} />
