<script lang="ts" module>
	import { type ColumnDef } from '@tanstack/table-core';
	import type { Node } from '#lib/types/db/index.js';

	type DataTableProps<TData, TValue> = {
		columns: ColumnDef<TData, TValue>[];
		data: TData[];
		is_footer_shown: boolean;
		highest_unit?: NonNullable<Node['highest_unit_form']>;
		is_in_vd_table?: boolean;
	};

	const ROW_ESTIMATE_SIZE = 41;
	const ROW_OVERSCAN = 10;
	// First paint before the viewport is measured (and jsdom's zero-layout runs):
	// render a small slice instead of every row.
	const INITIAL_RENDER_COUNT = 20;
</script>

<script lang="ts" generics="TData extends { id?: string }, TValue">
	import { getCoreRowModel } from '@tanstack/table-core';
	import { VirtualWindow } from '#lib/hooks/virtual-window.svelte.js';
	import { createSvelteTable, FlexRender } from '#lib/components/ui/data-table/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import * as Tooltip from '#lib/components/ui/tooltip/index.js';
	import { getTableStyle } from '#lib/components/ui/table/context.js';
	import { table as tableVariants } from '#lib/components/ui/table/variants.js';
	import { TableIcon } from '#lib/assets/icons/index.js';
	import { cn } from '#lib/utils/index.js';
	import TableActionDialogs from './table-action-dialogs.svelte';
	import { TableActionsState, setTableActions } from './table-actions.svelte.js';

	let {
		data,
		columns,
		is_footer_shown,
		highest_unit,
		is_in_vd_table
	}: DataTableProps<TData, TValue> = $props();

	setTableActions(new TableActionsState());

	// Bridges the imperative virtual-core instance to Svelte rendering in one
	// reusable place; see VirtualWindow.
	const virtual = new VirtualWindow({
		estimate_size: ROW_ESTIMATE_SIZE,
		overscan: ROW_OVERSCAN,
		initial_render_count: INITIAL_RENDER_COUNT,
		get_item_key: (index) => String((data[index] as TData | undefined)?.id ?? index)
	});

	// Mounts ResizeObserver/scroll observers and returns virtualizer cleanup on teardown.
	$effect(() => virtual.mount());

	// Syncs row count/keys and the scroll element; imperative lifecycle calls are required
	// by virtual-core and do not reassign unrelated component state.
	$effect(() => virtual.sync(data.length));

	// For large read-only virtualized tables (voltage drop), only feed the
	// visible window to TanStack so row-model cost scales with the viewport, not
	// the full dataset. Footers that aggregate over the row model are not used in
	// this mode.
	const table_data = $derived.by((): TData[] => {
		if (!is_in_vd_table) return data;
		return virtual.visible_items.flatMap((virtualRow) => {
			const item = data[virtualRow.index];
			return item ? [item] : [];
		});
	});

	const table = createSvelteTable({
		get data() {
			return table_data;
		},
		get columns() {
			return columns;
		},
		getCoreRowModel: getCoreRowModel()
	});

	const rows = $derived(table.getRowModel().rows);
	const leafColumnCount = $derived(
		Math.max(table.getVisibleLeafColumns().length, table.getAllLeafColumns().length)
	);
	const rowClasses = $derived(tableVariants(getTableStyle()()).row());
	const cellClasses = $derived(tableVariants(getTableStyle()()).cell());

	const visibleRows = $derived.by(() => {
		if (!is_in_vd_table) {
			return virtual.visible_items.flatMap((virtualRow) => {
				const row = rows[virtualRow.index];
				return row ? [{ key: String(virtualRow.key), index: virtualRow.index, row }] : [];
			});
		}
		// Windowed rows align with visible_items by position.
		return virtual.visible_items.flatMap((virtualRow, windowIndex) => {
			const row = rows[windowIndex];
			return row ? [{ key: String(virtualRow.key), index: virtualRow.index, row }] : [];
		});
	});
	const virtualPadding = $derived({
		start: virtual.padding_start,
		end: virtual.padding_end
	});

	function measureRow(node: Element) {
		virtual.measure(node);
	}
</script>

<Tooltip.Provider delayDuration={100}>
	<div
		class="border-border bg-card flex min-h-0 flex-1 [scrollbar-gutter:stable] flex-col overflow-auto rounded-xl border shadow-(--surface-shadow)"
		{@attach virtual.attach_scroll_element}
	>
		<TableActionDialogs {highest_unit} {is_in_vd_table} />
		<!-- scrollbar-gutter on the scroll box reserves the bar lanes, so rows
		never slide under them in any renderer. Transparent end borders would
		need to match the bar width in every engine and leave dead scroll room.
		Inner card chrome off: this box scrolls with the content, so its own
		border would slide into view as a fake cut-off edge. -->
		<Table.Root containerClass="overflow-visible rounded-none border-0 bg-transparent">
			<Table.Header class="bg-secondary sticky top-0 z-10">
				{#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
					<Table.Row>
						{#each headerGroup.headers as header, index (header.id)}
							<Table.Head
								colspan={header.colSpan}
								class={cn('text-muted-foreground h-10 align-middle font-semibold', {
									'border-border/60 border-r': index + 1 < headerGroup.headers.length,
									'text-center': header.colSpan > 1
								})}
							>
								{#if !header.isPlaceholder}
									<FlexRender
										content={header.column.columnDef.header}
										context={header.getContext()}
									/>
								{/if}
							</Table.Head>
						{/each}
					</Table.Row>
				{/each}
			</Table.Header>

			<Table.Body>
				{#if rows.length === 0}
					<Table.Row>
						<Table.Cell colspan={leafColumnCount} class="h-32 border-0">
							<div class="flex flex-col items-center justify-center gap-1.5 text-center">
								<TableIcon class="text-muted-foreground/60 size-7" />
								<p class="text-muted-foreground text-sm font-medium">Nothing here yet</p>
								<p class="text-muted-foreground/80 max-w-55 text-xs text-balance">
									Add a load or panel from the hierarchy to populate this schedule.
								</p>
							</div>
						</Table.Cell>
					</Table.Row>
				{:else}
					{#if virtualPadding.start > 0}
						<tr aria-hidden="true">
							<td
								colspan={leafColumnCount}
								class="border-0 p-0"
								style="height: {virtualPadding.start}px"
							></td>
						</tr>
					{/if}

					{#each visibleRows as visibleRow (visibleRow.key)}
						{@const row = visibleRow.row}
						{@const cells = row.getVisibleCells()}
						<tr
							{@attach measureRow}
							data-slot="table-row"
							data-index={visibleRow.index}
							data-state={row.getIsSelected() && 'selected'}
							class={cn(rowClasses, 'even:bg-muted/30', {
								'bg-primary/5': row.getIsSelected()
							})}
						>
							{#each cells as cell, cellIdx (cell.id)}
								<td
									data-slot="table-cell"
									class={cn(cellClasses, {
										'border-border/60 border-r': cellIdx + 1 !== cells.length,
										'text-center': cellIdx === 0 || cell.column.id === 'load_description',
										'min-w-62.5': cell.column.columnDef.header === 'LOAD DESCRIPTION'
									})}
								>
									<FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} />
								</td>
							{/each}
						</tr>
					{/each}

					{#if virtualPadding.end > 0}
						<tr aria-hidden="true">
							<td
								colspan={leafColumnCount}
								class="border-0 p-0"
								style="height: {virtualPadding.end}px"
							></td>
						</tr>
					{/if}
				{/if}
			</Table.Body>

			{#if data.length > 0 && is_footer_shown}
				<Table.Footer class="bg-muted/40 border-t">
					{#each table.getFooterGroups() as footerGroup, i (i)}
						{#if i === 0}
							<Table.Row>
								{#each footerGroup.headers as header, i (i)}
									<Table.Head
										colspan={header.colSpan}
										class={cn('text-foreground font-bold', {
											'border-border/60 border-r': i + 1 < footerGroup.headers.length,
											'text-center': i === 0,
											'p-0': header.column.id === 'conductor_sets'
										})}
									>
										{#if !header.isPlaceholder}
											<FlexRender
												content={header.column.columnDef.footer}
												context={header.getContext()}
											/>
										{/if}
									</Table.Head>
								{/each}
							</Table.Row>
						{/if}
					{/each}
				</Table.Footer>
			{/if}
		</Table.Root>
	</div>
</Tooltip.Provider>
