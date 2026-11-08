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
	import {
		Virtualizer,
		elementScroll,
		observeElementOffset,
		observeElementRect,
		type VirtualItem
	} from '@tanstack/virtual-core';
	import { getCoreRowModel } from '@tanstack/table-core';
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

	const table = createSvelteTable({
		get data() {
			return data;
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

	let scrollEl = $state<HTMLDivElement | null>(null);
	let virtualItems = $state<VirtualItem[]>([]);
	let virtualTotalSize = $state(0);
	let viewportHeight = $state(0);
	// Once a real viewport was seen, a 0 height means the table is hidden
	// (inactive tab), not that layout is unavailable.
	let has_measured_viewport = $state(false);

	function attachScrollElement(node: Element) {
		scrollEl = node as HTMLDivElement;
		return () => {
			scrollEl = null;
		};
	}

	function handleVirtualChange(instance: Virtualizer<HTMLDivElement, HTMLTableRowElement>) {
		viewportHeight = instance.scrollRect?.height ?? 0;
		if (viewportHeight > 0) has_measured_viewport = true;

		// A hidden tab reports a zero-height viewport. Keep the last rendered
		// window instead of recomputing an empty range, so switching back can
		// reuse those rows and measure them immediately.
		if (viewportHeight === 0 && has_measured_viewport) return;

		virtualItems = instance.getVirtualItems();
		virtualTotalSize = instance.getTotalSize();
	}

	// Bridges the imperative virtual-core instance to Svelte rendering; onChange and the
	// sync effect are required to integrate an external mutable virtualizer with runes.
	const rowVirtualizer = new Virtualizer<HTMLDivElement, HTMLTableRowElement>({
		count: 0,
		getScrollElement: () => scrollEl,
		estimateSize: () => ROW_ESTIMATE_SIZE,
		overscan: ROW_OVERSCAN,
		observeElementRect,
		observeElementOffset,
		scrollToFn: elementScroll,
		getItemKey: (index) => String(rows[index]?.id ?? index),
		onChange: handleVirtualChange
	});

	// Mounts ResizeObserver/scroll observers and returns virtualizer cleanup on teardown.
	$effect(() => rowVirtualizer._didMount());

	// Syncs row count/keys and the scroll element; imperative lifecycle calls are required
	// by virtual-core and do not reassign unrelated component state.
	$effect(() => {
		// setOptions replaces the full option set, so preserve the existing observers and
		// onChange whenever the reactive count/scroll element syncs.
		rowVirtualizer.setOptions({
			...rowVirtualizer.options,
			count: rows.length,
			getScrollElement: () => scrollEl,
			getItemKey: (index) => String(rows[index]?.id ?? index),
			onChange: handleVirtualChange
		});
		rowVirtualizer._willUpdate();
		handleVirtualChange(rowVirtualizer);
	});

	const visibleRows = $derived.by(() => {
		if (rows.length === 0) return [];
		if (virtualItems.length > 0) {
			return virtualItems.flatMap((virtualRow) => {
				const row = rows[virtualRow.index];
				return row ? [{ key: String(virtualRow.key), index: virtualRow.index, row }] : [];
			});
		}
		// The viewport has not been measured yet (first paint / jsdom), or the
		// row model changed before the virtualizer synced: render only the head.
		return rows
			.slice(0, INITIAL_RENDER_COUNT)
			.map((row, index) => ({ key: String(row.id ?? index), index, row }));
	});
	const virtualPadding = $derived.by(() => {
		if (virtualItems.length === 0 || visibleRows.length === rows.length) {
			return { start: 0, end: 0 };
		}
		const start = virtualItems[0]?.start ?? 0;
		const end = virtualTotalSize - (virtualItems[virtualItems.length - 1]?.end ?? 0);
		return { start: Math.max(0, start), end: Math.max(0, end) };
	});

	function measureRow(node: Element) {
		rowVirtualizer.measureElement(node as HTMLTableRowElement);
	}
</script>

<Tooltip.Provider delayDuration={100}>
	<div
		{@attach attachScrollElement}
		class="border-border bg-card flex min-h-0 flex-1 flex-col overflow-auto rounded-xl border shadow-(--surface-shadow)"
	>
		<TableActionDialogs {highest_unit} {is_in_vd_table} />
		<Table.Root containerClass="overflow-visible">
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
						<tr
							{@attach measureRow}
							data-slot="table-row"
							data-index={visibleRow.index}
							data-state={row.getIsSelected() && 'selected'}
							class={cn(rowClasses, 'even:bg-muted/30', {
								'bg-primary/5': row.getIsSelected()
							})}
						>
							{#each row.getVisibleCells() as cell, cellIdx (cell.id)}
								<td
									data-slot="table-cell"
									class={cn(cellClasses, {
										'border-border/60 border-r': cellIdx + 1 !== row.getVisibleCells().length,
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
