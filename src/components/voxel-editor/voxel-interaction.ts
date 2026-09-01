import type { Cell, FaceDirection, PaletteId } from '../../domain/voxel-editor'
import { GRID_SIZE, neighborOf, unpackCell } from '../../domain/voxel-editor'

export type PointerPoint = {
	x: number
	y: number
	z: number
}

export type VoxelEditTool = 'erase' | 'paint' | 'place'

export type HoverPreview = {
	cell: Cell
	kind: 'ghost' | 'outline'
	paletteId?: PaletteId
}

const faceDirectionsByAxis: Record<'-x' | '-y' | '-z' | 'x' | 'y' | 'z', FaceDirection> = {
	'-x': 'left',
	'-y': 'down',
	'-z': 'back',
	'x': 'right',
	'y': 'up',
	'z': 'front',
}

export function faceDirectionFromNormal(normal: PointerPoint): FaceDirection | undefined {
	const axisValues = [
		{ axis: 'x', value: normal.x },
		{ axis: 'y', value: normal.y },
		{ axis: 'z', value: normal.z },
	] as const
	const strongestAxis = axisValues.reduce((strongest, candidate) => (
		Math.abs(candidate.value) > Math.abs(strongest.value) ? candidate : strongest
	))

	if (Math.abs(strongestAxis.value) < 0.5) {
		return undefined
	}

	const key = Math.sign(strongestAxis.value) === -1 ? `-${strongestAxis.axis}` as const : strongestAxis.axis
	return faceDirectionsByAxis[key]
}

export function floorPointToCell(point: PointerPoint): Cell | undefined {
	const cell = {
		x: Math.floor(point.x),
		y: 0,
		z: Math.floor(point.z),
	}

	if (cell.x < 0 || cell.x >= GRID_SIZE || cell.z < 0 || cell.z >= GRID_SIZE) {
		return undefined
	}

	return cell
}

export function occupiedVoxelPreview({
	faceNormal,
	instanceId,
	packedCellsByInstanceId,
	paletteId,
	tool,
}: {
	faceNormal?: PointerPoint
	instanceId?: number
	packedCellsByInstanceId: ReadonlyArray<number>
	paletteId: PaletteId
	tool: VoxelEditTool
}): HoverPreview | undefined {
	if (instanceId === undefined) {
		return undefined
	}

	const packedCell = packedCellsByInstanceId[instanceId]
	if (packedCell === undefined) {
		return undefined
	}

	const cell = unpackCell(packedCell)
	if (tool !== 'place') {
		return outlinePreviewForCell(cell, tool, paletteId)
	}

	return placePreviewForCell(cell, faceNormal, paletteId)
}

function outlinePreviewForCell(cell: Cell, tool: Exclude<VoxelEditTool, 'place'>, paletteId: PaletteId): HoverPreview {
	return { cell, kind: 'outline', paletteId: tool === 'paint' ? paletteId : undefined }
}

function placePreviewForCell(cell: Cell, faceNormal: PointerPoint | undefined, paletteId: PaletteId): HoverPreview | undefined {
	if (faceNormal === undefined) {
		return undefined
	}

	const faceDirection = faceDirectionFromNormal(faceNormal)
	const targetCell = faceDirection === undefined ? undefined : neighborOf(cell, faceDirection)
	if (targetCell === undefined) {
		return undefined
	}

	return { cell: targetCell, kind: 'ghost', paletteId }
}

export function floorHoverPreview({
	paletteId,
	point,
	tool,
}: {
	paletteId: PaletteId
	point: PointerPoint
	tool: VoxelEditTool
}): HoverPreview | undefined {
	if (tool !== 'place') {
		return undefined
	}

	const cell = floorPointToCell(point)
	return cell === undefined ? undefined : { cell, kind: 'ghost', paletteId }
}
