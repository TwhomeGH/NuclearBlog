import type { Swup } from "@swup/astro/client";
import type { SiteConfig } from "./types/config";

declare global {
	interface WindowEventMap {
		layoutChange: CustomEvent<{ layout: "list" | "grid" }>;
	}
	interface HTMLElementTagNameMap {
		"table-of-contents": HTMLElement & {
			init?: () => void;
		};
	}

	interface Window {
		swup?: Swup;
		_postListSwupListenerAttached?: boolean;
		sakuraInitialized?: boolean;
		panelManager?: typeof import("./utils/panel-manager").panelManager;
		closeAnnouncement: () => void;
		pagefind: {
			search: (query: string) => Promise<{
				results: Array<{
					data: () => Promise<SearchResult>;
				}>;
			}>;
		};

		mobileTOCInit?: () => void;
		initSemifullScrollDetection?: () => void;
		iconifyLoaded?: boolean;
		__iconifyLoader?: {
			load: () => Promise<void>;
			addToPreloadQueue: (icons: string[]) => void;
			onLoad: (callback: () => void) => void;
			isLoaded: boolean;
		};
		siteConfig?: Pick<Partial<SiteConfig>, "toc">;
	}
}

interface SearchResult {
	url: string;
	meta: {
		title: string;
	};
	excerpt: string;
	content?: string;
	word_count?: number;
	filters?: Record<string, unknown>;
	anchors?: Array<{
		element: string;
		id: string;
		text: string;
		location: number;
	}>;
	weighted_locations?: Array<{
		weight: number;
		balanced_score: number;
		location: number;
	}>;
	locations?: number[];
	raw_content?: string;
	raw_url?: string;
	sub_results?: SearchResult[];
}

export { SearchResult };
