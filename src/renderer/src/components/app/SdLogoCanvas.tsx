import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Snacode 品牌 logo SVG 组件。
 * 替代原来的 PiLogoCanvas，使用 build/icon.svg 中的正确路径。
 */

type ColorKey = "logoGreen" | "logoBlue" | "ink" | "white";

const COLORS: Record<ColorKey, string> = {
	logoGreen: "#34a853",
	logoBlue: "#4285f4",
	ink: "#09090B",
	white: "#ffffff",
};

/** Snacode logo 路径（与 build/icon.svg 保持一致） */
const SNACODE_LOGO_PATH =
	"M184.421,320C184.421,333.488 173.488,344.421 160,344.421C146.512,344.421 135.579,333.488 135.579,320C135.579,283.746 152.813,262.909 178.644,249.812C198.497,239.746 224.844,235.148 251.315,231.108C268.789,228.441 286.295,225.968 300.972,220.888C314.691,216.139 325.579,208.848 325.579,192C325.579,175.36 314.711,167.952 301.021,163.246C278.398,155.47 249.258,153.94 223.403,150.221C201.81,147.114 182.161,142.445 167.766,134.329C147.827,123.087 135.579,106.235 135.579,80C135.579,66.512 146.512,55.579 160,55.579C173.488,55.579 184.421,66.512 184.421,80C184.421,88.437 190.739,91.925 198.254,94.74C214.531,100.836 236.294,102.704 257.998,105.388C284.632,108.682 311.15,113.066 331.126,122.931C357.178,135.797 374.421,156.533 374.421,192C374.421,227.82 357.153,248.347 331.111,261.186C311.327,270.939 285.064,275.366 258.685,279.392C241.285,282.048 223.849,284.575 209.233,289.78C195.306,294.74 184.421,302.547 184.421,320Z";

function isLightTheme() {
	return document.documentElement.getAttribute("data-theme") !== "dark";
}

export type SdLogoCanvasProps = {
	/** 画布 CSS 边长（正方形：宽=高=size） */
	size?: number;
	/** 挂载后是否自动播放一次 intro */
	autoPlay?: boolean;
	/** 点击是否重播 */
	playOnClick?: boolean;
	/**
	 * 外部重播令牌：数值变化时强制重播拼装动画。
	 * 用于 agent 启动/关闭等业务事件反馈；0/undefined 不触发。
	 */
	replayToken?: number;
	className?: string;
};

/**
 * Snacode SVG logo 组件。
 * 侧栏品牌位：支持点击重播动画。
 */
export function SdLogoCanvas(props: SdLogoCanvasProps) {
	const size = props.size ?? 32;
	const svgRef = useRef<SVGSVGElement>(null);
	const [animated, setAnimated] = useState(false);

	useEffect(() => {
		if (props.autoPlay !== false) {
			setAnimated(true);
		}

		const onTheme = () => {
			// 主题切换时刷新
		};
		const observer = new MutationObserver(onTheme);
		observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

		return () => {
			observer.disconnect();
		};
	}, [props.autoPlay]);

	useEffect(() => {
		const token = props.replayToken;
		if (token == null || token === 0) return;
		setAnimated(true);
		setTimeout(() => setAnimated(false), 500);
	}, [props.replayToken]);

	const handleActivate = () => {
		if (props.playOnClick === false) return;
		setAnimated(true);
		setTimeout(() => setAnimated(false), 500);
	};

	const fillColor = isLightTheme() ? "url(#logoGradient)" : "#ffffff";

	return (
		<button
			type="button"
			className={props.className ?? "sd-logo-canvas-stage"}
			aria-label="Play Snacode logo animation"
			onClick={handleActivate}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					handleActivate();
				}
			}}
			style={{ width: `${size}px`, height: `${size}px` }}
		>
			<svg
				ref={svgRef}
				viewBox="0 0 512 512"
				width={size}
				height={size}
				className={`sd-logo-canvas${animated ? " animating" : ""}`}
				aria-hidden="true"
			>
				<defs>
					<linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
						<stop offset="0%" stopColor="#34a853"/>
						<stop offset="100%" stopColor="#4285f4"/>
					</linearGradient>
					<filter id="logoGlow" x="-50%" y="-50%" width="200%" height="200%">
						<feGaussianBlur stdDeviation="8" result="coloredBlur"/>
						<feMerge>
							<feMergeNode in="coloredBlur"/>
							<feMergeNode in="SourceGraphic"/>
						</feMerge>
					</filter>
				</defs>
				<path
					fill={fillColor}
					d={SNACODE_LOGO_PATH}
					filter={animated ? "url(#logoGlow)" : undefined}
					style={{
						transition: "transform 0.3s ease-out, filter 0.3s ease-out",
						transform: animated ? "scale(1.1)" : "scale(1)",
					}}
				/>
			</svg>
		</button>
	);
}

// ── 右侧「Snacode」字标 ──────────────

const WORDMARK_ROWS = 7;
const WORDMARK_GAP = 1;

const WORDMARK_GLYPHS: Record<string, number[][]> = {
	S: [
		[1, 1, 1, 1, 0],
		[1, 1, 0, 0, 0],
		[0, 1, 1, 1, 0],
		[0, 0, 0, 1, 1],
		[1, 1, 1, 1, 0],
	],
	n: [
		[1, 1, 0, 0, 1],
		[1, 1, 1, 1, 0],
		[1, 1, 1, 1, 0],
		[1, 1, 1, 1, 0],
		[1, 1, 1, 1, 0],
		[1, 1, 0, 1, 0],
		[1, 1, 0, 0, 1],
	],
	a: [
		[0, 0, 0, 0, 0],
		[0, 1, 1, 1, 0],
		[1, 1, 0, 0, 1],
		[1, 1, 1, 1, 1],
		[1, 1, 0, 0, 1],
		[1, 1, 0, 0, 1],
		[0, 1, 1, 1, 0],
	],
	c: [
		[0, 0, 0, 0, 0],
		[0, 1, 1, 1, 0],
		[1, 1, 0, 0, 1],
		[1, 1, 0, 0, 0],
		[1, 1, 0, 0, 0],
		[1, 1, 0, 0, 1],
		[0, 1, 1, 1, 0],
	],
	o: [
		[0, 0, 0, 0, 0],
		[0, 1, 1, 1, 0],
		[1, 1, 0, 0, 1],
		[1, 1, 0, 0, 1],
		[1, 1, 0, 0, 1],
		[1, 1, 0, 0, 1],
		[0, 1, 1, 1, 0],
	],
	d: [
		[1, 1, 1, 1, 0],
		[1, 1, 0, 0, 1],
		[1, 1, 0, 0, 1],
		[1, 1, 0, 0, 1],
		[1, 1, 0, 0, 1],
		[1, 1, 0, 0, 1],
		[1, 1, 1, 1, 0],
	],
	e: [
		[0, 0, 0, 0, 0],
		[0, 1, 1, 1, 0],
		[1, 1, 0, 0, 1],
		[1, 1, 1, 1, 1],
		[1, 1, 0, 0, 0],
		[1, 1, 0, 0, 1],
		[0, 1, 1, 1, 0],
	],
};

function buildWordmarkCells(text: string): { cells: Record<string, ColorKey>; cols: number; rows: number } {
	const cells: Record<string, ColorKey> = {};
	let cursorX = 0;
	const color = isLightTheme() ? "ink" : "white";

	for (const ch of text) {
		const glyph = WORDMARK_GLYPHS[ch];
		if (!glyph) {
			cursorX += 3 + WORDMARK_GAP;
			continue;
		}
		const width = glyph[0]?.length ?? 0;
		for (let y = 0; y < WORDMARK_ROWS; y += 1) {
			const row = glyph[y] ?? [];
			for (let x = 0; x < width; x += 1) {
				if (!row[x]) continue;
				cells[`${y}:${cursorX + x}`] = color;
			}
		}
		cursorX += width + WORDMARK_GAP;
	}

	return {
		cells,
		cols: Math.max(cursorX - WORDMARK_GAP, 1),
		rows: WORDMARK_ROWS,
	};
}

export type SnacodeWordmarkCanvasProps = {
	/** 每个点阵格的 CSS 边长；与 logo 并排时建议 4~5 */
	cellSize?: number;
	text?: string;
	className?: string;
};

/**
 * 右侧 Snacode 字标：canvas 绘制点阵文字。
 */
export function SnacodeWordmarkCanvas(props: SnacodeWordmarkCanvasProps) {
	const cellSize = props.cellSize ?? 5;
	const text = props.text ?? "Snacode";
	const canvasRef = useRef<HTMLCanvasElement>(null);

	const paint = useCallback(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const { cells, cols, rows } = buildWordmarkCells(text);
		const dpr = window.devicePixelRatio || 1;
		const cssW = cols * cellSize;
		const cssH = rows * cellSize;
		const bitmapW = Math.max(1, Math.round(cssW * dpr));
		const bitmapH = Math.max(1, Math.round(cssH * dpr));

		if (canvas.width !== bitmapW || canvas.height !== bitmapH) {
			canvas.width = bitmapW;
			canvas.height = bitmapH;
		}
		canvas.style.width = `${cssW}px`;
		canvas.style.height = `${cssH}px`;

		const cellW = bitmapW / cols;
		const cellH = bitmapH / rows;
		const color = isLightTheme() ? "#09090B" : "#ffffff";

		ctx.clearRect(0, 0, bitmapW, bitmapH);

		for (const [position] of Object.entries(cells)) {
			const [y, x] = position.split(":").map(Number);
			ctx.fillStyle = color;
			ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
		}
	}, [cellSize, text]);

	useEffect(() => {
		paint();
		const observer = new MutationObserver(paint);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["data-theme"],
		});
		return () => observer.disconnect();
	}, [paint]);

	return (
		<canvas
			ref={canvasRef}
			className={props.className ?? "snacode-wordmark-canvas"}
			aria-hidden="true"
		/>
	);
}
