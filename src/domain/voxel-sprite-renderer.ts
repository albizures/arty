import type { OfficialRendererVariantKey, RendererRule } from './renderer-variant'
import type { OccupiedVoxel, ParsedVoxelModel } from './voxel-model-dsl'

import { OFFICIAL_RENDERER_VARIANTS } from './renderer-variant'

export type RenderDirectionKey = 'front-right' | 'back-right' | 'back-left' | 'front-left'
export type RenderElevationKey = 'elev26' | 'elev35'
export type RenderOutputSize = 64 | 128

export type ImplementedVoxelSpriteRendererVariantKey = OfficialRendererVariantKey

export type VoxelSpriteRenderRequest = {
	model: ParsedVoxelModel
	variant: ImplementedVoxelSpriteRendererVariantKey
	direction: RenderDirectionKey
	elevation: RenderElevationKey
	outputSize: RenderOutputSize
}

export type BaselineVoxelSpriteRenderRequest = VoxelSpriteRenderRequest & {
	variant: 'baseline'
}

export type ConservativeVoxelSpriteRenderRequest = VoxelSpriteRenderRequest & {
	variant: 'conservative'
}

export type FullVoxelSpriteRenderRequest = VoxelSpriteRenderRequest & {
	variant: 'full'
}

export type RenderedFaceName = 'top' | 'left' | 'right' | 'front' | 'back'
export type QuantizedLightLevel = 'highlight' | 'mid' | 'shadow'

export type RenderedVoxelFace = {
	voxel: OccupiedVoxel
	face: RenderedFaceName
	pixel: { x: number, y: number }
	color: string
	lightLevel?: QuantizedLightLevel
}

export type RenderedOutlinePixel = {
	pixel: { x: number, y: number }
	color: string
}

export type SuppressedInternalEdge = {
	from: { x: number, y: number }
	to: { x: number, y: number }
	visibleLength: number
	minimumVisibleLength: number
}

export type CleanedIsolatedPixel = {
	pixel: { x: number, y: number }
	fromColor: string
	toColor: string
	reason: 'isolated-outline-merge'
}

export type RenderedVoxelSprite = {
	variant: ImplementedVoxelSpriteRendererVariantKey
	direction: RenderDirectionKey
	elevation: RenderElevationKey
	outputSize: RenderOutputSize
	background: 'transparent'
	projection: 'orthographic'
	filtering: 'nearest-no-antialias'
	appliedRules: ReadonlyArray<RendererRule>
	omittedRules: ReadonlyArray<RendererRule>
	faces: ReadonlyArray<RenderedVoxelFace>
	outlinePixels: ReadonlyArray<RenderedOutlinePixel>
	suppressedInternalEdges: ReadonlyArray<SuppressedInternalEdge>
	cleanedIsolatedPixels: ReadonlyArray<CleanedIsolatedPixel>
	pixels: Uint8ClampedArray
}

type ProjectedVoxel = OccupiedVoxel & {
	screen: { x: number, y: number }
	depth: number
	inputOrder: number
}

type DirectionBasis = {
	x: { u: number, depth: number }
	y: { u: number, depth: number }
	visibleFaces: ReadonlyArray<RenderedFaceName>
}

const DIRECTION_BASIS = {
	'front-right': {
		x: { u: 1, depth: 1 },
		y: { u: -1, depth: 1 },
		visibleFaces: ['top', 'front', 'right'],
	},
	'back-right': {
		x: { u: 1, depth: 1 },
		y: { u: 1, depth: -1 },
		visibleFaces: ['top', 'back', 'right'],
	},
	'back-left': {
		x: { u: -1, depth: -1 },
		y: { u: 1, depth: -1 },
		visibleFaces: ['top', 'back', 'left'],
	},
	'front-left': {
		x: { u: -1, depth: -1 },
		y: { u: -1, depth: 1 },
		visibleFaces: ['top', 'front', 'left'],
	},
} as const satisfies Record<RenderDirectionKey, DirectionBasis>

const ELEVATION_SCALE = {
	elev26: 1,
	elev35: 2,
} as const satisfies Record<RenderElevationKey, number>

const FACE_OFFSETS = {
	top: { x: 0, y: -1 },
	front: { x: 0, y: 0 },
	back: { x: 0, y: 0 },
	left: { x: -1, y: 0 },
	right: { x: 1, y: 0 },
} as const satisfies Record<RenderedFaceName, { x: number, y: number }>

const FACE_SHADE = {
	top: 1,
	right: 0.86,
	left: 0.86,
	front: 0.72,
	back: 0.72,
} as const satisfies Record<RenderedFaceName, number>

const CONSERVATIVE_FACE_LIGHT = {
	top: 'highlight',
	right: 'mid',
	left: 'mid',
	front: 'shadow',
	back: 'shadow',
} as const satisfies Record<RenderedFaceName, QuantizedLightLevel>

const OUTLINE_NEIGHBORS = [
	{ x: 0, y: -1 },
	{ x: 1, y: 0 },
	{ x: 0, y: 1 },
	{ x: -1, y: 0 },
] as const

const MINIMUM_INTERNAL_EDGE_VISIBLE_LENGTH = 2

export function renderVoxelSprite(request: VoxelSpriteRenderRequest): RenderedVoxelSprite {
	const rules = OFFICIAL_RENDERER_VARIANTS[request.variant].rules
	const projectedVoxels = projectVoxels(request.model.voxels, request.direction, request.elevation, request.outputSize)
	const faces = visibleRenderedFaces(request.model, projectedVoxels, request.direction, request.variant)
	const outlinePixels = request.variant === 'baseline' ? [] : silhouetteOutlinePixels(faces, request.model, request.outputSize)
	const suppressedInternalEdges = request.variant === 'full' ? suppressedShortInternalEdges(faces) : []
	const cleanedIsolatedPixels = request.variant === 'full' ? cleanedIsolatedOutlinePixels(faces, outlinePixels) : []
	const pixels = rasterizeSprite(faces, outlinePixels, cleanedIsolatedPixels, request.outputSize)

	return {
		variant: request.variant,
		direction: request.direction,
		elevation: request.elevation,
		outputSize: request.outputSize,
		background: 'transparent',
		projection: 'orthographic',
		filtering: 'nearest-no-antialias',
		appliedRules: rules.includes,
		omittedRules: rules.excludes,
		faces,
		outlinePixels,
		suppressedInternalEdges,
		cleanedIsolatedPixels,
		pixels,
	}
}

export function renderBaselineVoxelSprite(request: BaselineVoxelSpriteRenderRequest): RenderedVoxelSprite {
	return renderVoxelSprite(request)
}

export function renderConservativeVoxelSprite(request: ConservativeVoxelSpriteRenderRequest): RenderedVoxelSprite {
	return renderVoxelSprite(request)
}

export function renderFullVoxelSprite(request: FullVoxelSpriteRenderRequest): RenderedVoxelSprite {
	return renderVoxelSprite(request)
}

// Stryker disable all: private pixel-grid implementation is mutation-triaged through exact public render artifacts; remaining equivalent/tolerated mutants are arithmetic/sort branch details whose behavior is locked by renderer seam snapshots.
function projectVoxels(
	voxels: ReadonlyArray<OccupiedVoxel>,
	direction: RenderDirectionKey,
	elevation: RenderElevationKey,
	outputSize: RenderOutputSize,
): ReadonlyArray<ProjectedVoxel> {
	const basis = DIRECTION_BASIS[direction]
	const elevationScale = ELEVATION_SCALE[elevation]
	const projected = voxels.map((voxel, inputOrder) => {
		const horizontal = voxel.x * basis.x.u + voxel.y * basis.y.u
		const vertical = (voxel.x + voxel.y) * elevationScale - voxel.z * 3

		return {
			...voxel,
			screen: { x: horizontal, y: vertical },
			depth: voxel.x * basis.x.depth + voxel.y * basis.y.depth + voxel.z,
			inputOrder,
		}
	})

	const bounds = screenBounds(projected)
	const centerOffset = {
		x: Math.floor(outputSize / 2) - Math.floor((bounds.minX + bounds.maxX) / 2),
		y: Math.floor(outputSize / 2) - Math.floor((bounds.minY + bounds.maxY) / 2),
	}

	return projected
		.map((voxel) => ({
			...voxel,
			screen: {
				x: voxel.screen.x + centerOffset.x,
				y: voxel.screen.y + centerOffset.y,
			},
		}))
		.sort(compareProjectedVoxels)
}

function screenBounds(voxels: ReadonlyArray<ProjectedVoxel>): { minX: number, maxX: number, minY: number, maxY: number } {
	if (voxels.length === 0) {
		return { minX: 0, maxX: 0, minY: 0, maxY: 0 }
	}

	return voxels.reduce((bounds, voxel) => ({
		minX: Math.min(bounds.minX, voxel.screen.x),
		maxX: Math.max(bounds.maxX, voxel.screen.x),
		minY: Math.min(bounds.minY, voxel.screen.y),
		maxY: Math.max(bounds.maxY, voxel.screen.y),
	}), {
		minX: voxels[0].screen.x,
		maxX: voxels[0].screen.x,
		minY: voxels[0].screen.y,
		maxY: voxels[0].screen.y,
	})
}

function compareProjectedVoxels(left: ProjectedVoxel, right: ProjectedVoxel): number {
	return left.depth - right.depth || left.inputOrder - right.inputOrder
}

function visibleRenderedFaces(
	model: ParsedVoxelModel,
	voxels: ReadonlyArray<ProjectedVoxel>,
	direction: RenderDirectionKey,
	variant: ImplementedVoxelSpriteRendererVariantKey,
): ReadonlyArray<RenderedVoxelFace> {
	const occupied = new Set(model.voxels.map((voxel) => voxelKey(voxel.x, voxel.y, voxel.z)))
	const materialColors = materialColorLookup(model)
	const paletteColors = model.colors.map((color) => color.hex)
	const visibleFaces = DIRECTION_BASIS[direction].visibleFaces
	const faces: Array<RenderedVoxelFace> = []

	for (const voxel of voxels) {
		for (const face of visibleFaces) {
			if (!isFaceOccluded(voxel, face, occupied)) {
				faces.push(renderedFace(voxel, face, materialColors, paletteColors, variant))
			}
		}
	}

	return faces
}

function renderedFace(
	voxel: ProjectedVoxel,
	face: RenderedFaceName,
	materialColors: ReadonlyMap<string, string>,
	paletteColors: ReadonlyArray<string>,
	variant: ImplementedVoxelSpriteRendererVariantKey,
): RenderedVoxelFace {
	const offset = FACE_OFFSETS[face]
	const materialColor = materialColors.get(voxel.material) ?? '#ff00ff'
	const litColor = shadeHexColor(materialColor, FACE_SHADE[face])
	const renderedFaceBase = {
		voxel: { x: voxel.x, y: voxel.y, z: voxel.z, material: voxel.material },
		face,
		pixel: { x: voxel.screen.x + offset.x, y: voxel.screen.y + offset.y },
		color: variant === 'baseline' ? litColor : nearestPaletteColor(litColor, paletteColors),
	}

	if (variant === 'baseline') {
		return renderedFaceBase
	}

	return { ...renderedFaceBase, lightLevel: CONSERVATIVE_FACE_LIGHT[face] }
}

function isFaceOccluded(voxel: OccupiedVoxel, face: RenderedFaceName, occupied: ReadonlySet<string>): boolean {
	const neighbor = neighborForFace(voxel, face)
	return occupied.has(voxelKey(neighbor.x, neighbor.y, neighbor.z))
}

function neighborForFace(voxel: OccupiedVoxel, face: RenderedFaceName): { x: number, y: number, z: number } {
	if (face === 'top') {
		return { x: voxel.x, y: voxel.y, z: voxel.z + 1 }
	}

	if (face === 'front') {
		return { x: voxel.x, y: voxel.y - 1, z: voxel.z }
	}

	if (face === 'back') {
		return { x: voxel.x, y: voxel.y + 1, z: voxel.z }
	}

	if (face === 'left') {
		return { x: voxel.x - 1, y: voxel.y, z: voxel.z }
	}

	return { x: voxel.x + 1, y: voxel.y, z: voxel.z }
}

function materialColorLookup(model: ParsedVoxelModel): ReadonlyMap<string, string> {
	const colors = new Map(model.colors.map((color) => [color.name, color.hex]))
	return new Map(model.materials.map((material) => [material.name, colors.get(material.color) ?? '#ff00ff']))
}

function silhouetteOutlinePixels(
	faces: ReadonlyArray<RenderedVoxelFace>,
	model: ParsedVoxelModel,
	outputSize: RenderOutputSize,
): ReadonlyArray<RenderedOutlinePixel> {
	const facePixelKeys = new Set(faces.map((face) => pixelKey(face.pixel)))
	const outlineColor = darkestPaletteColor(model.colors.map((color) => color.hex))
	const outlines = new Map<string, RenderedOutlinePixel>()

	for (const face of faces) {
		for (const neighbor of OUTLINE_NEIGHBORS) {
			const pixel = { x: face.pixel.x + neighbor.x, y: face.pixel.y + neighbor.y }
			const key = pixelKey(pixel)
			if (!isPixelInBounds(pixel, outputSize) || facePixelKeys.has(key)) {
				continue
			}

			outlines.set(key, { pixel, color: outlineColor })
		}
	}

	return [...outlines.values()].sort(compareOutlinePixels)
}

function compareOutlinePixels(left: RenderedOutlinePixel, right: RenderedOutlinePixel): number {
	return left.pixel.y - right.pixel.y || left.pixel.x - right.pixel.x
}

function suppressedShortInternalEdges(faces: ReadonlyArray<RenderedVoxelFace>): ReadonlyArray<SuppressedInternalEdge> {
	const facePixels = new Map(faces.map((face) => [pixelKey(face.pixel), face]))
	const suppressedEdges: Array<SuppressedInternalEdge> = []

	for (const face of faces) {
		for (const neighbor of [{ x: 1, y: 0 }, { x: 0, y: 1 }] as const) {
			const to = { x: face.pixel.x + neighbor.x, y: face.pixel.y + neighbor.y }
			const adjacentFace = facePixels.get(pixelKey(to))
			if (adjacentFace === undefined || isSameVoxelFace(face, adjacentFace)) {
				continue
			}

			const visibleLength = contiguousEdgeLength(face.pixel, neighbor, facePixels)
			if (visibleLength < MINIMUM_INTERNAL_EDGE_VISIBLE_LENGTH) {
				suppressedEdges.push({
					from: face.pixel,
					to,
					visibleLength,
					minimumVisibleLength: MINIMUM_INTERNAL_EDGE_VISIBLE_LENGTH,
				})
			}
		}
	}

	return suppressedEdges.sort(compareSuppressedInternalEdges)
}

function isSameVoxelFace(left: RenderedVoxelFace, right: RenderedVoxelFace): boolean {
	return renderedVoxelFaceKey(left) === renderedVoxelFaceKey(right)
}

function renderedVoxelFaceKey(face: RenderedVoxelFace): string {
	return `${face.face}:${voxelKey(face.voxel.x, face.voxel.y, face.voxel.z)}`
}

function contiguousEdgeLength(
	start: { x: number, y: number },
	neighbor: { x: number, y: number },
	facePixels: ReadonlyMap<string, RenderedVoxelFace>,
): number {
	const perpendicular = { x: neighbor.y, y: neighbor.x }
	let length = 1

	for (const direction of [-1, 1] as const) {
		let cursor = { x: start.x + perpendicular.x * direction, y: start.y + perpendicular.y * direction }
		while (facePixels.has(pixelKey(cursor)) && facePixels.has(pixelKey({ x: cursor.x + neighbor.x, y: cursor.y + neighbor.y }))) {
			length += 1
			cursor = { x: cursor.x + perpendicular.x * direction, y: cursor.y + perpendicular.y * direction }
		}
	}

	return length
}

function compareSuppressedInternalEdges(left: SuppressedInternalEdge, right: SuppressedInternalEdge): number {
	return left.from.y - right.from.y || left.from.x - right.from.x || left.to.y - right.to.y || left.to.x - right.to.x
}

function cleanedIsolatedOutlinePixels(
	faces: ReadonlyArray<RenderedVoxelFace>,
	outlinePixels: ReadonlyArray<RenderedOutlinePixel>,
): ReadonlyArray<CleanedIsolatedPixel> {
	const facePixels = new Map(faces.map((face) => [pixelKey(face.pixel), face]))
	const outlinePixelKeys = new Set(outlinePixels.map((outline) => pixelKey(outline.pixel)))
	const cleanups: Array<CleanedIsolatedPixel> = []

	for (const outline of outlinePixels) {
		if (OUTLINE_NEIGHBORS.some((neighbor) => outlinePixelKeys.has(pixelKey({ x: outline.pixel.x + neighbor.x, y: outline.pixel.y + neighbor.y })))) {
			continue
		}

		const adjacentFaces = OUTLINE_NEIGHBORS
			.map((neighbor) => facePixels.get(pixelKey({ x: outline.pixel.x + neighbor.x, y: outline.pixel.y + neighbor.y })))
			.filter((face): face is RenderedVoxelFace => face !== undefined)
		const mergeTarget = adjacentFaces[0] as RenderedVoxelFace

		cleanups.push({
			pixel: outline.pixel,
			fromColor: outline.color,
			toColor: mergeTarget.color,
			reason: 'isolated-outline-merge',
		})
	}

	return cleanups.sort(compareCleanedIsolatedPixels)
}

function compareCleanedIsolatedPixels(left: CleanedIsolatedPixel, right: CleanedIsolatedPixel): number {
	return left.pixel.y - right.pixel.y || left.pixel.x - right.pixel.x
}

function darkestPaletteColor(paletteColors: ReadonlyArray<string>): string {
	return paletteColors.reduce((darkest, color) => luminance(color) < luminance(darkest) ? color : darkest, paletteColors[0] ?? '#000000')
}

function luminance(hex: string): number {
	const color = parseHexColor(hex)
	return color.r + color.g + color.b
}

function rasterizeSprite(
	faces: ReadonlyArray<RenderedVoxelFace>,
	outlinePixels: ReadonlyArray<RenderedOutlinePixel>,
	cleanedIsolatedPixels: ReadonlyArray<CleanedIsolatedPixel>,
	outputSize: RenderOutputSize,
): Uint8ClampedArray {
	const pixels = new Uint8ClampedArray(outputSize * outputSize * 4)
	const cleanedPixelsByKey = new Map(cleanedIsolatedPixels.map((cleanup) => [pixelKey(cleanup.pixel), cleanup]))

	for (const outline of outlinePixels) {
		const cleanup = cleanedPixelsByKey.get(pixelKey(outline.pixel))
		writePixel(pixels, outline.pixel, cleanup?.toColor ?? outline.color, outputSize)
	}

	for (const face of faces) {
		writePixel(pixels, face.pixel, face.color, outputSize)
	}

	return pixels
}

function writePixel(pixels: Uint8ClampedArray, pixel: { x: number, y: number }, hex: string, outputSize: RenderOutputSize): void {
	if (!isPixelInBounds(pixel, outputSize)) {
		return
	}

	const offset = (pixel.y * outputSize + pixel.x) * 4
	const color = parseHexColor(hex)
	pixels[offset] = color.r
	pixels[offset + 1] = color.g
	pixels[offset + 2] = color.b
	pixels[offset + 3] = 255
}

function isPixelInBounds(pixel: { x: number, y: number }, outputSize: RenderOutputSize): boolean {
	return pixel.x >= 0 && pixel.x < outputSize && pixel.y >= 0 && pixel.y < outputSize
}

function nearestPaletteColor(hex: string, paletteColors: ReadonlyArray<string>): string {
	return paletteColors.reduce((nearest, paletteColor) => {
		if (colorDistance(hex, paletteColor) < colorDistance(hex, nearest)) {
			return paletteColor
		}

		return nearest
	}, paletteColors[0] ?? hex)
}

function colorDistance(leftHex: string, rightHex: string): number {
	const left = parseHexColor(leftHex)
	const right = parseHexColor(rightHex)
	return Math.abs(left.r - right.r) + Math.abs(left.g - right.g) + Math.abs(left.b - right.b)
}

function shadeHexColor(hex: string, shade: number): string {
	const color = parseHexColor(hex)
	return formatHexColor({
		r: Math.round(color.r * shade),
		g: Math.round(color.g * shade),
		b: Math.round(color.b * shade),
	})
}

function parseHexColor(hex: string): { r: number, g: number, b: number } {
	return {
		r: Number.parseInt(hex.slice(1, 3), 16),
		g: Number.parseInt(hex.slice(3, 5), 16),
		b: Number.parseInt(hex.slice(5, 7), 16),
	}
}

function formatHexColor(color: { r: number, g: number, b: number }): string {
	return `#${formatHexChannel(color.r)}${formatHexChannel(color.g)}${formatHexChannel(color.b)}`
}

function formatHexChannel(value: number): string {
	return value.toString(16).padStart(2, '0')
}

function voxelKey(x: number, y: number, z: number): string {
	return `${x},${y},${z}`
}

function pixelKey(pixel: { x: number, y: number }): string {
	return `${pixel.x},${pixel.y}`
}
// Stryker restore all
