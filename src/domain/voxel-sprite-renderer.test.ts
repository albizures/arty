import type { ParsedVoxelModel } from './voxel-model-dsl'

import { describe, expect, it } from 'vitest'

import { OFFICIAL_RENDERER_VARIANTS } from './renderer-variant'
import { renderBaselineVoxelSprite, renderConservativeVoxelSprite, renderFullVoxelSprite, renderVoxelSprite } from './voxel-sprite-renderer'

const CART_MODEL = {
	name: 'cart',
	size: { x: 2, y: 2, z: 2 },
	palette: 'default',
	colors: [
		{ name: 'wood', hex: '#aabbcc' },
		{ name: 'trim', hex: '#334455' },
	],
	materials: [
		{ name: 'body', color: 'wood' },
		{ name: 'accent', color: 'trim' },
	],
	voxels: [
		{ x: 0, y: 0, z: 0, material: 'body' },
		{ x: 1, y: 0, z: 0, material: 'accent' },
		{ x: 0, y: 1, z: 0, material: 'body' },
	],
} as const satisfies ParsedVoxelModel

describe('renderBaselineVoxelSprite', () => {
	it('returns deterministic baseline pixels and artifact data for the same named inputs', () => {
		const request = {
			model: CART_MODEL,
			variant: 'baseline',
			direction: 'front-right',
			elevation: 'elev26',
			outputSize: 64,
		} as const

		const firstRender = renderBaselineVoxelSprite(request)
		const secondRender = renderBaselineVoxelSprite(request)

		expect(firstRender.faces).toEqual(secondRender.faces)
		expect([...firstRender.pixels]).toEqual([...secondRender.pixels])
		expect(firstRender).toMatchObject({
			variant: 'baseline',
			direction: 'front-right',
			elevation: 'elev26',
			outputSize: 64,
		})
	})

	it('uses transparent background, orthographic projection, and nearest/no-antialias output', () => {
		const render = renderBaselineVoxelSprite({
			model: CART_MODEL,
			variant: 'baseline',
			direction: 'back-left',
			elevation: 'elev35',
			outputSize: 64,
		})

		expect(render.background).toBe('transparent')
		expect(render.projection).toBe('orthographic')
		expect(render.filtering).toBe('nearest-no-antialias')

		const alphaValues = alphaChannelValues(render.pixels)
		expect(alphaValues).toContain(0)
		expect(alphaValues).toContain(255)
		expect(new Set(alphaValues)).toEqual(new Set([0, 255]))
	})

	it('applies only the official baseline rule set and omits specialized pixel-art treatments', () => {
		const render = renderBaselineVoxelSprite({
			model: CART_MODEL,
			variant: 'baseline',
			direction: 'front-left',
			elevation: 'elev26',
			outputSize: 128,
		})

		expect(render.appliedRules).toEqual(OFFICIAL_RENDERER_VARIANTS.baseline.rules.includes)
		expect(render.omittedRules).toEqual([
			'palette-constrained-output',
			'integer-aligned-projection',
			'deterministic-occlusion',
			'quantized-directional-lighting',
			'silhouette-outlines',
			'internal-edge-suppression',
			'isolated-pixel-cleanup',
		])
		expect(render.outlinePixels).toEqual([])
		expect(render.suppressedInternalEdges).toEqual([])
		expect(render.cleanedIsolatedPixels).toEqual([])
	})

	it('uses deterministic face visibility, projection, shading, and occlusion', () => {
		const render = renderBaselineVoxelSprite({
			model: CART_MODEL,
			variant: 'baseline',
			direction: 'front-right',
			elevation: 'elev26',
			outputSize: 64,
		})

		expect(render.faces).toEqual([
			{ voxel: { x: 0, y: 0, z: 0, material: 'body' }, face: 'top', pixel: { x: 32, y: 31 }, color: '#aabbcc' },
			{ voxel: { x: 0, y: 0, z: 0, material: 'body' }, face: 'front', pixel: { x: 32, y: 32 }, color: '#7a8793' },
			{ voxel: { x: 1, y: 0, z: 0, material: 'accent' }, face: 'top', pixel: { x: 33, y: 32 }, color: '#334455' },
			{ voxel: { x: 1, y: 0, z: 0, material: 'accent' }, face: 'front', pixel: { x: 33, y: 33 }, color: '#25313d' },
			{ voxel: { x: 1, y: 0, z: 0, material: 'accent' }, face: 'right', pixel: { x: 34, y: 33 }, color: '#2c3a49' },
			{ voxel: { x: 0, y: 1, z: 0, material: 'body' }, face: 'top', pixel: { x: 31, y: 32 }, color: '#aabbcc' },
			{ voxel: { x: 0, y: 1, z: 0, material: 'body' }, face: 'right', pixel: { x: 32, y: 33 }, color: '#92a1af' },
		])
		expect(pixelColorAt(render.pixels, { x: 32, y: 32 }, 64)).toBe('#7a8793')
		expect(pixelColorAt(render.pixels, { x: 0, y: 0 }, 64)).toBe('transparent')
	})

	it('renders an empty model as a fully transparent deterministic artifact', () => {
		const render = renderBaselineVoxelSprite({
			model: { ...CART_MODEL, voxels: [] },
			variant: 'baseline',
			direction: 'front-right',
			elevation: 'elev26',
			outputSize: 64,
		})

		expect(render.faces).toEqual([])
		expect(new Set(alphaChannelValues(render.pixels))).toEqual(new Set([0]))
	})

	it('keeps rasterization deterministic for out-of-frame faces and malformed material colors', () => {
		const oversizedModel = {
			...CART_MODEL,
			colors: [],
			materials: [],
			voxels: Array.from({ length: 80 }, (_unused, x) => ({ x, y: 0, z: 0, material: 'ghost' })),
		} satisfies ParsedVoxelModel
		const missingColorModel = {
			...CART_MODEL,
			colors: [],
			materials: [{ name: 'ghost', color: 'missing' }],
			voxels: [{ x: 0, y: 0, z: 0, material: 'ghost' }],
		} satisfies ParsedVoxelModel

		const render = renderBaselineVoxelSprite({
			model: oversizedModel,
			variant: 'baseline',
			direction: 'front-right',
			elevation: 'elev26',
			outputSize: 64,
		})
		const missingColorRender = renderBaselineVoxelSprite({
			model: missingColorModel,
			variant: 'baseline',
			direction: 'front-right',
			elevation: 'elev26',
			outputSize: 64,
		})

		expect(render.faces).toContainEqual(expect.objectContaining({
			face: 'top',
			color: '#ff00ff',
		}))
		expect(missingColorRender.faces).toContainEqual(expect.objectContaining({
			face: 'top',
			color: '#ff00ff',
		}))
		expect(alphaChannelValues(render.pixels)).toContain(255)
	})
})

function alphaChannelValues(pixels: Uint8ClampedArray): Array<number> {
	const values: Array<number> = []
	for (let index = 3; index < pixels.length; index += 4) {
		values.push(pixels[index])
	}
	return values
}

describe('renderConservativeVoxelSprite', () => {
	it('returns deterministic conservative pixels and artifact data from the shared render seam', () => {
		const request = {
			model: CART_MODEL,
			variant: 'conservative',
			direction: 'front-right',
			elevation: 'elev26',
			outputSize: 64,
		} as const

		const firstRender = renderVoxelSprite(request)
		const secondRender = renderConservativeVoxelSprite(request)

		expect(firstRender.faces).toEqual(secondRender.faces)
		expect(firstRender.outlinePixels).toEqual(secondRender.outlinePixels)
		expect([...firstRender.pixels]).toEqual([...secondRender.pixels])
		expect(firstRender).toMatchObject({
			variant: 'conservative',
			direction: 'front-right',
			elevation: 'elev26',
			outputSize: 64,
		})
	})

	it('applies conservative rules and excludes full cleanup rules', () => {
		const render = renderConservativeVoxelSprite({
			model: CART_MODEL,
			variant: 'conservative',
			direction: 'front-left',
			elevation: 'elev35',
			outputSize: 128,
		})

		expect(render.appliedRules).toEqual(OFFICIAL_RENDERER_VARIANTS.conservative.rules.includes)
		expect(render.omittedRules).toEqual([
			'internal-edge-suppression',
			'isolated-pixel-cleanup',
		])
		expect(render.outlinePixels.length).toBeGreaterThan(0)
		expect(render.faces.every((face) => face.lightLevel !== undefined)).toBe(true)
		expect(render.suppressedInternalEdges).toEqual([])
		expect(render.cleanedIsolatedPixels).toEqual([])
	})

	it('keeps conservative face and outline pixels constrained to the model palette', () => {
		const render = renderConservativeVoxelSprite({
			model: CART_MODEL,
			variant: 'conservative',
			direction: 'back-right',
			elevation: 'elev26',
			outputSize: 64,
		})
		const palette = new Set<string>(CART_MODEL.colors.map((color) => color.hex))

		expect(render.faces.length).toBeGreaterThan(0)
		expect(render.faces.every((face) => palette.has(face.color))).toBe(true)
		expect(render.outlinePixels.every((outline) => palette.has(outline.color))).toBe(true)
		expect(opaquePixelColors(render.pixels).every((color) => palette.has(color))).toBe(true)
	})

	it('uses integer-aligned projection and deterministic occlusion shared with baseline', () => {
		const render = renderConservativeVoxelSprite({
			model: CART_MODEL,
			variant: 'conservative',
			direction: 'front-right',
			elevation: 'elev26',
			outputSize: 64,
		})

		expect(render.faces.every((face) => Number.isInteger(face.pixel.x) && Number.isInteger(face.pixel.y))).toBe(true)
		expect(render.outlinePixels.every((outline) => Number.isInteger(outline.pixel.x) && Number.isInteger(outline.pixel.y))).toBe(true)
		expect(render.faces).toContainEqual(expect.objectContaining({
			voxel: { x: 0, y: 0, z: 0, material: 'body' },
			face: 'front',
		}))
		expect(render.faces).not.toContainEqual(expect.objectContaining({
			voxel: { x: 0, y: 0, z: 0, material: 'body' },
			face: 'right',
		}))
	})

	it('keeps fallback colors deterministic when palette data is missing', () => {
		const missingPaletteModel = {
			...CART_MODEL,
			colors: [],
			materials: [],
			voxels: [{ x: 0, y: 0, z: 0, material: 'ghost' }],
		} satisfies ParsedVoxelModel

		const render = renderConservativeVoxelSprite({
			model: missingPaletteModel,
			variant: 'conservative',
			direction: 'front-right',
			elevation: 'elev26',
			outputSize: 64,
		})

		expect(render.faces).toContainEqual(expect.objectContaining({
			face: 'top',
			color: '#ff00ff',
		}))
		expect(render.outlinePixels).toContainEqual(expect.objectContaining({ color: '#000000' }))
	})
})

describe('renderFullVoxelSprite', () => {
	it('returns deterministic full pixels and artifact data from the shared render seam', () => {
		const request = {
			model: CART_MODEL,
			variant: 'full',
			direction: 'front-right',
			elevation: 'elev26',
			outputSize: 64,
		} as const

		const firstRender = renderVoxelSprite(request)
		const secondRender = renderFullVoxelSprite(request)

		expect(firstRender.faces).toEqual(secondRender.faces)
		expect(firstRender.outlinePixels).toEqual(secondRender.outlinePixels)
		expect(firstRender.suppressedInternalEdges).toEqual(secondRender.suppressedInternalEdges)
		expect(firstRender.cleanedIsolatedPixels).toEqual(secondRender.cleanedIsolatedPixels)
		expect([...firstRender.pixels]).toEqual([...secondRender.pixels])
		expect(firstRender).toMatchObject({
			variant: 'full',
			direction: 'front-right',
			elevation: 'elev26',
			outputSize: 64,
		})
	})

	it('applies every conservative renderer rule plus full cleanup rules', () => {
		const render = renderFullVoxelSprite({
			model: CART_MODEL,
			variant: 'full',
			direction: 'front-left',
			elevation: 'elev35',
			outputSize: 128,
		})

		expect(render.appliedRules).toEqual(OFFICIAL_RENDERER_VARIANTS.full.rules.includes)
		expect(render.omittedRules).toEqual([])
		expect(render.appliedRules).toEqual(expect.arrayContaining([...OFFICIAL_RENDERER_VARIANTS.conservative.rules.includes]))
		expect(render.outlinePixels.length).toBeGreaterThan(0)
		expect(render.faces.every((face) => face.lightLevel !== undefined)).toBe(true)
	})

	it('records deterministic suppression for visible internal edges below the minimum length', () => {
		const render = renderFullVoxelSprite({
			model: CART_MODEL,
			variant: 'full',
			direction: 'front-right',
			elevation: 'elev26',
			outputSize: 64,
		})

		expect(render.suppressedInternalEdges).toContainEqual(expect.objectContaining({
			visibleLength: 1,
			minimumVisibleLength: 2,
		}))
		expect(render.suppressedInternalEdges).toEqual([...render.suppressedInternalEdges].sort((left, right) => {
			return left.from.y - right.from.y || left.from.x - right.from.x || left.to.y - right.to.y || left.to.x - right.to.x
		}))
	})

	it('merges isolated outline pixels into adjacent face colors deterministically and keeps output palette-constrained', () => {
		const render = renderFullVoxelSprite({
			model: CART_MODEL,
			variant: 'full',
			direction: 'front-right',
			elevation: 'elev26',
			outputSize: 64,
		})
		const palette = new Set<string>(CART_MODEL.colors.map((color) => color.hex))

		expect(render.outlinePixels).toEqual([
			{ pixel: { x: 32, y: 30 }, color: '#334455' },
			{ pixel: { x: 31, y: 31 }, color: '#334455' },
			{ pixel: { x: 33, y: 31 }, color: '#334455' },
			{ pixel: { x: 30, y: 32 }, color: '#334455' },
			{ pixel: { x: 34, y: 32 }, color: '#334455' },
			{ pixel: { x: 31, y: 33 }, color: '#334455' },
			{ pixel: { x: 35, y: 33 }, color: '#334455' },
			{ pixel: { x: 32, y: 34 }, color: '#334455' },
			{ pixel: { x: 33, y: 34 }, color: '#334455' },
			{ pixel: { x: 34, y: 34 }, color: '#334455' },
		])
		expect(render.cleanedIsolatedPixels).toEqual([
			{ pixel: { x: 32, y: 30 }, fromColor: '#334455', toColor: '#aabbcc', reason: 'isolated-outline-merge' },
			{ pixel: { x: 31, y: 31 }, fromColor: '#334455', toColor: '#aabbcc', reason: 'isolated-outline-merge' },
			{ pixel: { x: 33, y: 31 }, fromColor: '#334455', toColor: '#334455', reason: 'isolated-outline-merge' },
			{ pixel: { x: 30, y: 32 }, fromColor: '#334455', toColor: '#aabbcc', reason: 'isolated-outline-merge' },
			{ pixel: { x: 34, y: 32 }, fromColor: '#334455', toColor: '#334455', reason: 'isolated-outline-merge' },
			{ pixel: { x: 31, y: 33 }, fromColor: '#334455', toColor: '#aabbcc', reason: 'isolated-outline-merge' },
			{ pixel: { x: 35, y: 33 }, fromColor: '#334455', toColor: '#334455', reason: 'isolated-outline-merge' },
		])
		expect(pixelColorAt(render.pixels, { x: 32, y: 30 }, 64)).toBe('#aabbcc')
		expect(render.cleanedIsolatedPixels.every((cleanup) => palette.has(cleanup.toColor))).toBe(true)
		expect(opaquePixelColors(render.pixels).every((color) => palette.has(color))).toBe(true)
	})
})

function pixelColorAt(pixels: Uint8ClampedArray, pixel: { x: number, y: number }, outputSize: number): string {
	const offset = (pixel.y * outputSize + pixel.x) * 4
	if (pixels[offset + 3] === 0) {
		return 'transparent'
	}

	return formatHexColor(pixels[offset], pixels[offset + 1], pixels[offset + 2])
}

function opaquePixelColors(pixels: Uint8ClampedArray): Array<string> {
	const colors: Array<string> = []
	for (let index = 0; index < pixels.length; index += 4) {
		if (pixels[index + 3] === 0) {
			continue
		}

		colors.push(formatHexColor(pixels[index], pixels[index + 1], pixels[index + 2]))
	}
	return colors
}

function formatHexColor(red: number, green: number, blue: number): string {
	return `#${formatHexChannel(red)}${formatHexChannel(green)}${formatHexChannel(blue)}`
}

function formatHexChannel(value: number): string {
	return value.toString(16).padStart(2, '0')
}
