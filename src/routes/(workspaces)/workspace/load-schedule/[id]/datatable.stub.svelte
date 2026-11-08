<script lang="ts">
	let { data, is_footer_shown }: { data: unknown[]; is_footer_shown: boolean } = $props();
</script>

<div data-testid="datatable-stub" data-rows={data.length} data-footer={is_footer_shown}></div>
