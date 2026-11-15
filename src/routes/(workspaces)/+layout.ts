export const load = async ({ url: { searchParams } }) => {
	// No `depends('app:workspace')`: this load runs only when the route's
	// search params change. Live project data derives from SignalDB cursors
	// inside the layout, so mutations never rerun a load.
	return {
		is_new_file: searchParams.get('new_file') === 'true'
	};
};
