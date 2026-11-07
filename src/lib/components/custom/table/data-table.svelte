<script lang="ts" module>
	import { type ColumnDef } from '@tanstack/table-core';

	type DataTableProps<TData, TValue> = {
		columns: ColumnDef<TData, TValue>[];
		data: TData[];
		is_footer_shown: boolean;
	};
</script>

<script lang="ts" generics="TData, TValue">
	import { getCoreRowModel } from '@tanstack/table-core';
	import { createSvelteTable, FlexRender } from '#lib/components/ui/data-table/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { TableIcon } from '#lib/assets/icons/index.js';
	import { cn } from '#lib/utils/index.js';

	let { data, columns, is_footer_shown }: DataTableProps<TData, TValue> = $props();

	const table = createSvelteTable({
		get data() {
			return data;
		},
		get columns() {
			return columns;
		},
		getCoreRowModel: getCoreRowModel()
	});
</script>

<div
	class="border-border bg-card flex min-h-0 flex-1 flex-col overflow-auto rounded-xl border shadow-(--surface-shadow)"
>
	<Table.Root>
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
			{#each table.getRowModel().rows as row (row.id)}
				<Table.Row
					data-state={row.getIsSelected() && 'selected'}
					class={cn('even:bg-muted/30', { 'bg-primary/5': row.getIsSelected() })}
				>
					{#each row.getVisibleCells() as cell, cellIdx (cell.id)}
						<Table.Cell
							class={cn({
								'border-border/60 border-r': cellIdx + 1 !== row.getVisibleCells().length,
								'text-center': cellIdx === 0 || cell.column.id === 'load_description',
								'min-w-62.5': cell.column.columnDef.header === 'LOAD DESCRIPTION'
								// 'p-0': cell.column.id === 'conductor_sets',
							})}
						>
							<FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} />
						</Table.Cell>
					{/each}
				</Table.Row>
			{:else}
				<Table.Row>
					<Table.Cell colspan={columns.length * 3} class="h-32 border-0">
						<div class="flex flex-col items-center justify-center gap-1.5 text-center">
							<TableIcon class="text-muted-foreground/60 size-7" />
							<p class="text-muted-foreground text-sm font-medium">Nothing here yet</p>
							<p class="text-muted-foreground/80 max-w-55 text-xs text-balance">
								Add a load or panel from the hierarchy to populate this schedule.
							</p>
						</div>
					</Table.Cell>
				</Table.Row>
			{/each}
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
