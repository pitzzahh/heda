<script lang="ts" module>
	export type SeenColumns = { footer: boolean; columns: unknown[] };
	export const seen_columns: SeenColumns[] = [];
</script>

<script lang="ts">
	let {
		data,
		columns,
		is_footer_shown
	}: { data: unknown[]; columns: unknown[]; is_footer_shown: boolean } = $props();

	$effect(() => {
		seen_columns.push({ footer: is_footer_shown, columns });
	});
</script>

<div data-testid="datatable-stub" data-rows={data.length} data-footer={is_footer_shown}></div>
