import type { Cell, PaletteId, VoxelEditorState } from '../../domain/voxel-editor'

export const voxelPalette = {
	black: '#1e293b',
	blue: '#3b82f6',
	green: '#22c55e',
	orange: '#f97316',
	purple: '#8b5cf6',
	red: '#ef4444',
	white: '#f8fafc',
	yellow: '#eab308',
} satisfies Record<PaletteId, string>

export type VoxelRenderInstance = {
	packedCell: number
	position: [number, number, number]
	color: string
}

export type VoxelRenderInstances = {
	instances: ReadonlyArray<VoxelRenderInstance>
	packedCellsByInstanceId: ReadonlyArray<number>
}

export function deriveVoxelRenderInstances(state: VoxelEditorState): VoxelRenderInstances {
	const instances = Array.from(state.voxels.entries())
		.sort(([leftPackedCell], [rightPackedCell]) => leftPackedCell - rightPackedCell)
		.map(([packedCell, voxel]) => ({
			packedCell,
			position: cellToVoxelCenter(voxel.cell),
			color: voxelPalette[voxel.paletteId],
		}))

	return {
		instances,
		packedCellsByInstanceId: instances.map((instance) => instance.packedCell),
	}
}

export function cellToVoxelCenter(cell: Cell): [number, number, number] {
	return [cell.x + 0.5, cell.y + 0.5, cell.z + 0.5]
}
