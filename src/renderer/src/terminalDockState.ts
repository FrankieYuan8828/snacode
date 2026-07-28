export type TerminalDockState = {
	open: boolean;
	collapsed: boolean;
};

export type TerminalDockStateByProject = Record<string, TerminalDockState>;

export function setTerminalDockOpen(
	current: TerminalDockStateByProject,
	projectId: string,
	open: boolean,
): TerminalDockStateByProject {
	return {
		...current,
		[projectId]: {
			open,
			collapsed: current[projectId]?.collapsed ?? false,
		},
	};
}

export function setTerminalDockCollapsed(
	current: TerminalDockStateByProject,
	projectId: string,
	collapsed: boolean,
): TerminalDockStateByProject {
	return {
		...current,
		[projectId]: {
			open: current[projectId]?.open ?? true,
			collapsed,
		},
	};
}

export function pruneTerminalDockState(
	current: TerminalDockStateByProject,
	activeIds: Set<string>,
): TerminalDockStateByProject {
	return Object.fromEntries(
		Object.entries(current).filter(([projectId]) => activeIds.has(projectId)),
	);
}
