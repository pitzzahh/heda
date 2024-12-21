<script lang="ts" generics="TData, TValue">
	import { type ColumnDef, getCoreRowModel } from '@tanstack/table-core';
	import { createSvelteTable, FlexRender } from '$lib/components/ui/data-table/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { cn } from '@/utils';

	type DataTableProps<TData, TValue> = {
		columns: ColumnDef<TData, TValue>[];
		data: TData[];
	};

	let { data, columns }: DataTableProps<TData, TValue> = $props();

	const table = createSvelteTable({
		get data() {
			return data;
		},
		columns,
		getCoreRowModel: getCoreRowModel()
	});
</script>

<div class="rounded-md border">
	<Table.Root>
		<Table.Header>
			{#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
				<Table.Row>
					{#each headerGroup.headers as header, index (header.id)}
						<Table.Head
							colspan={header.colSpan}
							class={cn('bg-muted/50 font-semibold', {
								'border-r': index + 1 < headerGroup.headers.length,
								'text-center': header.colSpan
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
			{#each table.getRowModel().rows as row, index (row.id)}
				<Table.Row data-state={row.getIsSelected() && 'selected'}>
					{#each row.getVisibleCells() as cell, cellIdx (cell.id)}
						<Table.Cell
							class={cn({
								'border-r': index + 1 !== row.getVisibleCells().length,
								'text-center': cellIdx === 0,
								'min-w-[250px]': cell.column.columnDef.header === 'LOAD DESCRIPTION',
								'p-0': cell.column.id === 'conductor_sets'
							})}
						>
							<FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} />
						</Table.Cell>
					{/each}
				</Table.Row>
			{:else}
				<Table.Row>
					<Table.Cell colspan={columns.length * 3} class="h-24 text-center">No data.</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>

		{#if data.length > 0}
			<Table.Footer class="border-t bg-muted/10">
				{#each table.getFooterGroups() as footerGroup, i (i)}
					{#if i === 0}
						<Table.Row>
							{#each footerGroup.headers as header, i (i)}
								<Table.Head
									colspan={header.colSpan}
									class={cn('bg-muted/50', {
										'border-r': i + 1 < footerGroup.headers.length,
										'text-center font-semibold': i === 0,
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
