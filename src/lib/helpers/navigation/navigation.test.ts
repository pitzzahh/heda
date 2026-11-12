import { describe, expect, it } from 'vitest';
import { loadScheduleRouteId, nodeIdFromRouteId } from './index.js';

describe('loadScheduleRouteId', () => {
	it('puts the node id after the name', () => {
		expect(loadScheduleRouteId('Main Distribution Board', 'node-1')).toBe(
			'Main%20Distribution%20Board_node-1'
		);
	});

	it('encodes a slash so the name stays one path segment', () => {
		const route_id = loadScheduleRouteId('Utility Meter / MDU', 'node-1');
		expect(route_id).not.toContain('/');
		expect(route_id).toBe('Utility%20Meter%20%2F%20MDU_node-1');
	});

	it('leaves the separator alone', () => {
		expect(loadScheduleRouteId('Panel', 'node-1').split('_').at(-1)).toBe('node-1');
	});
});

describe('nodeIdFromRouteId', () => {
	it('reads the node id back', () => {
		expect(nodeIdFromRouteId(loadScheduleRouteId('Main Distribution Board', 'node-1'))).toBe(
			'node-1'
		);
	});

	it('reads the node id back from a name with a slash', () => {
		expect(nodeIdFromRouteId(loadScheduleRouteId('Utility Meter / MDU', 'node-1'))).toBe('node-1');
	});

	it('reads the node id back from a name with an underscore', () => {
		expect(nodeIdFromRouteId(loadScheduleRouteId('Main_Panel', 'node-1'))).toBe('node-1');
	});

	it('has no node id without a route id', () => {
		expect(nodeIdFromRouteId(undefined)).toBeUndefined();
	});
});
