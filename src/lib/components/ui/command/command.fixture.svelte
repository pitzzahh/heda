<script lang="ts" module>
	interface Props {
		value?: string;
	}
</script>

<script lang="ts">
	import * as Command from './index.js';

	let { value = $bindable('') }: Props = $props();
</script>

<Command.Root bind:value>
	<Command.Input placeholder="Search..." />
	<Command.Empty>Nothing found.</Command.Empty>
	<Command.Group>
		<Command.Item value="alpha">Alpha</Command.Item>
		<Command.Item value="beta">Beta</Command.Item>
	</Command.Group>
</Command.Root>
<p data-testid="value">{value}</p>
