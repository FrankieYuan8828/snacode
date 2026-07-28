import type { SnacodeDesktopApi } from "../../../preload";

declare global {
	interface Window {
		snacodeDesktop: SnacodeDesktopApi;
	}
}

export function useIpc() {
	return window.snacodeDesktop;
}