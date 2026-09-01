import type { Cell, PaletteId, VoxelEditorState } from '../../../../src/domain/voxel-editor'
import { describe, expect, it } from 'vitest'
import { cellToVoxelCenter, deriveVoxelRenderInstances } from '../../../../src/components/voxel-editor/voxel-rendering'
import { createEmptyVoxelEditorState, packCell, placeVoxel } from '../../../../src/domain/voxel-editor'

describe('voxel rendering helpers', () => {
	it('places unit cubes at cell centers', () => {
		expect(cellToVoxelCenter({ x: 2, y: 3, z: 4 })).toEqual([2.5, 3.5, 4.5])
	})

	it('derives sorted colored render instances and the instance lookup from domain state', () => {
		const state = placeMany([
			{ cell: { x: 3, y: 0, z: 0 }, paletteId: 'red' },
			{ cell: { x: 1, y: 0, z: 0 }, paletteId: 'blue' },
			{ cell: { x: 2, y: 1, z: 0 }, paletteId: 'green' },
		])

		const renderInstances = deriveVoxelRenderInstances(state)

		expect(renderInstances).toEqual({
			instances: [
				{ packedCell: packCell({ x: 1, y: 0, z: 0 }), position: [1.5, 0.5, 0.5], color: '#3b82f6' },
				{ packedCell: packCell({ x: 3, y: 0, z: 0 }), position: [3.5, 0.5, 0.5], color: '#ef4444' },
				{ packedCell: packCell({ x: 2, y: 1, z: 0 }), position: [2.5, 1.5, 0.5], color: '#22c55e' },
			],
			packedCellsByInstanceId: [
				packCell({ x: 1, y: 0, z: 0 }),
				packCell({ x: 3, y: 0, z: 0 }),
				packCell({ x: 2, y: 1, z: 0 }),
			],
		})
	})
})

function placeMany(voxels: ReadonlyArray<{ cell: Cell, paletteId: PaletteId }>): VoxelEditorState {
	return voxels.reduce(
		(state, command) => placeVoxel(state, command).state,
		createEmptyVoxelEditorState(),
	)
}
