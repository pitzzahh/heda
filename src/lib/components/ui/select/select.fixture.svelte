<script lang="ts" module>
	interface Props {
		open?: boolean;
		value?: string;
	}
</script>

<script lang="ts">
	import * as Select from './index.js';

	let { open = $bindable(false), value = $bindable('') }: Props = $props();
</script>

<Select.Root
	bind:open
	bind:value
	items={[
		{ value: 'a', label: 'Option A' },
		{ value: 'b', label: 'Option B' }
	]}
>
	<Select.Trigger>Pick an option</Select.Trigger>
	<Select.Content>
		<Select.Item value="a" label="Option A" />
		<Select.Item value="b" label="Option B" />
	</Select.Content>
</Select.Root>
<p data-testid="value">{value}</p>
