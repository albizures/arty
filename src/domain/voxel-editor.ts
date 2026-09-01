export const GRID_SIZE = 16
export const GRID_CELL_COUNT = GRID_SIZE * GRID_SIZE * GRID_SIZE

export type PaletteId = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'white' | 'black'

export type Cell = {
	x: number
	y: number
	z: number
}

export type Voxel = {
	cell: Cell
	paletteId: PaletteId
}

export type VoxelMap = ReadonlyMap<number, Voxel>

export type VoxelEditorState = {
	voxels: VoxelMap
}

export type FaceDirection = 'left' | 'right' | 'down' | 'up' | 'back' | 'front'

export type VoxelCommandResult = {
	state: VoxelEditorState
	changed: boolean
	reason?: VoxelCommandNoopReason
}

export type VoxelCommandNoopReason = 'out-of-bounds' | 'empty-cell' | 'same-palette'

const faceOffsets = {
	back: { x: 0, y: 0, z: -1 },
	down: { x: 0, y: -1, z: 0 },
	front: { x: 0, y: 0, z: 1 },
	left: { x: -1, y: 0, z: 0 },
	right: { x: 1, y: 0, z: 0 },
	up: { x: 0, y: 1, z: 0 },
} satisfies Record<FaceDirection, Cell>

export function createEmptyVoxelEditorState(): VoxelEditorState {
	return { voxels: new Map() }
}

export function isCellInBounds(cell: Cell): boolean {
	return isGridCoordinate(cell.x) && isGridCoordinate(cell.y) && isGridCoordinate(cell.z)
}

export function packCell(cell: Cell): number {
	return cell.x + cell.y * GRID_SIZE + cell.z * GRID_SIZE * GRID_SIZE
}

export function unpackCell(index: number): Cell {
	const z = Math.floor(index / (GRID_SIZE * GRID_SIZE))
	const remainder = index - z * GRID_SIZE * GRID_SIZE
	const y = Math.floor(remainder / GRID_SIZE)
	const x = remainder - y * GRID_SIZE

	return { x, y, z }
}

export function neighborOf(cell: Cell, face: FaceDirection): Cell | undefined {
	const offset = faceOffsets[face]
	const neighbor = {
		x: cell.x + offset.x,
		y: cell.y + offset.y,
		z: cell.z + offset.z,
	}

	if (!isCellInBounds(neighbor)) {
		return undefined
	}

	return neighbor
}

export function placeVoxel(
	state: VoxelEditorState,
	command: { cell: Cell, paletteId: PaletteId },
): VoxelCommandResult {
	if (!isCellInBounds(command.cell)) {
		return unchanged(state, 'out-of-bounds')
	}

	const nextVoxels = new Map(state.voxels)
	const voxel = { cell: command.cell, paletteId: command.paletteId }
	nextVoxels.set(packCell(command.cell), voxel)

	return changed(nextVoxels)
}

export function eraseVoxel(state: VoxelEditorState, command: { cell: Cell }): VoxelCommandResult {
	if (!isCellInBounds(command.cell)) {
		return unchanged(state, 'out-of-bounds')
	}

	const packedCell = packCell(command.cell)
	if (!state.voxels.has(packedCell)) {
		return unchanged(state, 'empty-cell')
	}

	const nextVoxels = new Map(state.voxels)
	nextVoxels.delete(packedCell)

	return changed(nextVoxels)
}

export function paintVoxel(
	state: VoxelEditorState,
	command: { cell: Cell, paletteId: PaletteId },
): VoxelCommandResult {
	if (!isCellInBounds(command.cell)) {
		return unchanged(state, 'out-of-bounds')
	}

	const packedCell = packCell(command.cell)
	const existingVoxel = state.voxels.get(packedCell)
	if (existingVoxel === undefined) {
		return unchanged(state, 'empty-cell')
	}
	if (existingVoxel.paletteId === command.paletteId) {
		return unchanged(state, 'same-palette')
	}

	const nextVoxels = new Map(state.voxels)
	nextVoxels.set(packedCell, { cell: command.cell, paletteId: command.paletteId })

	return changed(nextVoxels)
}

function isGridCoordinate(value: number): boolean {
	return Number.isInteger(value) && value >= 0 && value < GRID_SIZE
}

function unchanged(state: VoxelEditorState, reason: VoxelCommandNoopReason): VoxelCommandResult {
	return { state, changed: false, reason }
}

function changed(voxels: VoxelMap): VoxelCommandResult {
	return { state: { voxels }, changed: true }
}
