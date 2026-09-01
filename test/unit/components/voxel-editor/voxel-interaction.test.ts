import { describe, expect, it } from 'vitest'
import {
	faceDirectionFromNormal,
	floorHoverPreview,
	floorPointToCell,
	occupiedVoxelPreview,
} from '../../../../src/components/voxel-editor/voxel-interaction'
import { packCell } from '../../../../src/domain/voxel-editor'

describe('voxel interaction helpers', () => {
	it('maps face normals to domain face directions', () => {
		expect(faceDirectionFromNormal({ x: 1, y: 0, z: 0 })).toBe('right')
		expect(faceDirectionFromNormal({ x: -1, y: 0, z: 0 })).toBe('left')
		expect(faceDirectionFromNormal({ x: 0, y: 1, z: 0 })).toBe('up')
		expect(faceDirectionFromNormal({ x: 0, y: -1, z: 0 })).toBe('down')
		expect(faceDirectionFromNormal({ x: 0, y: 0, z: 1 })).toBe('front')
		expect(faceDirectionFromNormal({ x: 0, y: 0, z: -1 })).toBe('back')
	})

	it('keeps the first axis as strongest when face-normal strengths tie', () => {
		expect(faceDirectionFromNormal({ x: 0.75, y: -0.75, z: 0 })).toBe('right')
	})

	it('accepts face normals at the minimum strength threshold', () => {
		expect(faceDirectionFromNormal({ x: 0, y: 0.5, z: 0 })).toBe('up')
	})

	it('rejects ambiguous face normals', () => {
		expect(faceDirectionFromNormal({ x: 0.2, y: 0.3, z: 0.4 })).toBeUndefined()
	})

	it('converts floor hit points to y-zero cells inside the grid only', () => {
		expect(floorPointToCell({ x: 0.2, y: -0.02, z: 15.9 })).toEqual({ x: 0, y: 0, z: 15 })
		expect(floorPointToCell({ x: 15.99, y: -0.02, z: 0 })).toEqual({ x: 15, y: 0, z: 0 })
		expect(floorPointToCell({ x: -0.01, y: -0.02, z: 0 })).toBeUndefined()
		expect(floorPointToCell({ x: 0, y: -0.02, z: -0.01 })).toBeUndefined()
		expect(floorPointToCell({ x: 16, y: -0.02, z: 0 })).toBeUndefined()
		expect(floorPointToCell({ x: 0, y: -0.02, z: 16 })).toBeUndefined()
	})

	it('previews place targets adjacent to occupied voxel faces', () => {
		const packedCellsByInstanceId = [packCell({ x: 1, y: 1, z: 1 })]

		expect(occupiedVoxelPreview({
			faceNormal: { x: 0, y: 1, z: 0 },
			instanceId: 0,
			packedCellsByInstanceId,
			paletteId: 'green',
			tool: 'place',
		})).toEqual({ cell: { x: 1, y: 2, z: 1 }, kind: 'ghost', paletteId: 'green' })
	})

	it('rejects occupied place previews outside domain bounds', () => {
		const packedCellsByInstanceId = [packCell({ x: 15, y: 15, z: 15 })]

		expect(occupiedVoxelPreview({
			faceNormal: { x: 0, y: 1, z: 0 },
			instanceId: 0,
			packedCellsByInstanceId,
			paletteId: 'green',
			tool: 'place',
		})).toBeUndefined()
	})

	it('rejects occupied previews without a valid hit target', () => {
		const packedCellsByInstanceId = [packCell({ x: 1, y: 1, z: 1 })]
		const packedCellsWithUndefinedProperty = [packCell({ x: 1, y: 1, z: 1 })]
		Object.assign(packedCellsWithUndefinedProperty, { undefined: packCell({ x: 2, y: 2, z: 2 }) })

		expect(occupiedVoxelPreview({
			faceNormal: { x: 0, y: 1, z: 0 },
			packedCellsByInstanceId: packedCellsWithUndefinedProperty,
			paletteId: 'green',
			tool: 'place',
		})).toBeUndefined()
		expect(occupiedVoxelPreview({
			faceNormal: { x: 0, y: 1, z: 0 },
			instanceId: 4,
			packedCellsByInstanceId,
			paletteId: 'green',
			tool: 'paint',
		})).toBeUndefined()
		expect(occupiedVoxelPreview({
			instanceId: 0,
			packedCellsByInstanceId,
			paletteId: 'green',
			tool: 'place',
		})).toBeUndefined()
		expect(occupiedVoxelPreview({
			faceNormal: { x: 0.1, y: 0.2, z: 0.3 },
			instanceId: 0,
			packedCellsByInstanceId,
			paletteId: 'green',
			tool: 'place',
		})).toBeUndefined()
	})

	it('previews paint and erase as outlines on occupied voxel targets', () => {
		const packedCellsByInstanceId = [packCell({ x: 2, y: 3, z: 4 })]

		expect(occupiedVoxelPreview({
			instanceId: 0,
			packedCellsByInstanceId,
			paletteId: 'purple',
			tool: 'paint',
		})).toEqual({ cell: { x: 2, y: 3, z: 4 }, kind: 'outline', paletteId: 'purple' })
		expect(occupiedVoxelPreview({
			instanceId: 0,
			packedCellsByInstanceId,
			paletteId: 'purple',
			tool: 'erase',
		})).toEqual({ cell: { x: 2, y: 3, z: 4 }, kind: 'outline', paletteId: undefined })
	})

	it('previews valid floor placement only for the place tool', () => {
		expect(floorHoverPreview({
			paletteId: 'orange',
			point: { x: 3.4, y: -0.02, z: 5.6 },
			tool: 'place',
		})).toEqual({ cell: { x: 3, y: 0, z: 5 }, kind: 'ghost', paletteId: 'orange' })
		expect(floorHoverPreview({
			paletteId: 'orange',
			point: { x: 3.4, y: -0.02, z: 5.6 },
			tool: 'erase',
		})).toBeUndefined()
		expect(floorHoverPreview({
			paletteId: 'orange',
			point: { x: 16, y: -0.02, z: 5.6 },
			tool: 'place',
		})).toBeUndefined()
	})
})
