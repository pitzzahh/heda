/**
 * The load schedule route id: a readable name, then the node id. Every reader
 * takes the last underscore-separated part as the node id.
 *
 * The name is percent-encoded because the router splits the path on slashes
 * before it matches a route. A name like "Utility Meter / MDU" would
 * otherwise become two path segments, and the route would not match at all.
 * Percent-encoding keeps the name readable in the address bar and leaves the
 * underscore separator alone.
 */
export function loadScheduleRouteId(name: string, node_id: string): string {
	return `${encodeURIComponent(name)}_${node_id}`;
}

/**
 * The node id inside a load schedule route id. The name may hold
 * underscores, so the id is the part after the last one.
 */
export function nodeIdFromRouteId(route_id: string | undefined): string | undefined {
	return route_id?.split('_').at(-1);
}
