import type {
	Cell,
} from '../../../src/domain/voxel-editor'
import { describe, expect, it } from 'vitest'
import {
	createEmptyVoxelEditorState,
	eraseVoxel,
	GRID_CELL_COUNT,
	GRID_SIZE,
	isCellInBounds,
	neighborOf,
	packCell,
	paintVoxel,
	placeVoxel,
	unpackCell,
} from '../../../src/domain/voxel-editor'

describe('voxel editor domain', () => {
	it('packs and unpacks 16×16×16 cell coordinates', () => {
		expect(GRID_SIZE).toBe(16)
		expect(GRID_CELL_COUNT).toBe(4096)
		expect(packCell({ x: 0, y: 0, z: 0 })).toBe(0)
		expect(packCell({ x: 15, y: 15, z: 15 })).toBe(4095)
		expect(packCell({ x: 3, y: 2, z: 1 })).toBe(291)
		expect(unpackCell(0)).toEqual({ x: 0, y: 0, z: 0 })
		expect(unpackCell(291)).toEqual({ x: 3, y: 2, z: 1 })
		expect(unpackCell(4095)).toEqual({ x: 15, y: 15, z: 15 })
	})

	it('classifies integer cells inside the fixed bounds only', () => {
		expect(isCellInBounds({ x: 0, y: 0, z: 0 })).toBe(true)
		expect(isCellInBounds({ x: 15, y: 15, z: 15 })).toBe(true)
		expect(isCellInBounds({ x: -1, y: 0, z: 0 })).toBe(false)
		expect(isCellInBounds({ x: 0, y: -1, z: 0 })).toBe(false)
		expect(isCellInBounds({ x: 0, y: 0, z: -1 })).toBe(false)
		expect(isCellInBounds({ x: 16, y: 15, z: 15 })).toBe(false)
		expect(isCellInBounds({ x: 15, y: 16, z: 15 })).toBe(false)
		expect(isCellInBounds({ x: 15, y: 15, z: 16 })).toBe(false)
		expect(isCellInBounds({ x: 1.5, y: 0, z: 0 })).toBe(false)
	})

	it('returns in-bounds face neighbors and omits neighbors outside the grid', () => {
		const cell: Cell = { x: 8, y: 7, z: 6 }

		expect(neighborOf(cell, 'left')).toEqual({ x: 7, y: 7, z: 6 })
		expect(neighborOf(cell, 'right')).toEqual({ x: 9, y: 7, z: 6 })
		expect(neighborOf(cell, 'down')).toEqual({ x: 8, y: 6, z: 6 })
		expect(neighborOf(cell, 'up')).toEqual({ x: 8, y: 8, z: 6 })
		expect(neighborOf(cell, 'back')).toEqual({ x: 8, y: 7, z: 5 })
		expect(neighborOf(cell, 'front')).toEqual({ x: 8, y: 7, z: 7 })
		expect(neighborOf({ x: 0, y: 0, z: 0 }, 'left')).toBeUndefined()
		expect(neighborOf({ x: 0, y: 0, z: 0 }, 'down')).toBeUndefined()
		expect(neighborOf({ x: 0, y: 0, z: 0 }, 'back')).toBeUndefined()
		expect(neighborOf({ x: 15, y: 15, z: 15 }, 'right')).toBeUndefined()
		expect(neighborOf({ x: 15, y: 15, z: 15 }, 'up')).toBeUndefined()
		expect(neighborOf({ x: 15, y: 15, z: 15 }, 'front')).toBeUndefined()
	})

	it('places a voxel in an empty cell without mutating the previous state', () => {
		const initialState = createEmptyVoxelEditorState()
		const result = placeVoxel(initialState, { cell: { x: 1, y: 2, z: 3 }, paletteId: 'blue' })

		expect(result).toMatchObject({ changed: true })
		expect(result.reason).toBeUndefined()
		expect(initialState.voxels.size).toBe(0)
		expect(result.state.voxels.get(packCell({ x: 1, y: 2, z: 3 }))).toEqual({
			cell: { x: 1, y: 2, z: 3 },
			paletteId: 'blue',
		})
	})

	it('rejects out-of-bounds placement without changing state', () => {
		const initialState = createEmptyVoxelEditorState()
		const result = placeVoxel(initialState, { cell: { x: 16, y: 0, z: 0 }, paletteId: 'blue' })

		expect(result).toEqual({ state: initialState, changed: false, reason: 'out-of-bounds' })
	})

	it('replaces the palette when placing over an occupied cell', () => {
		const placed = placeVoxel(createEmptyVoxelEditorState(), { cell: { x: 4, y: 5, z: 6 }, paletteId: 'red' })
		const replaced = placeVoxel(placed.state, { cell: { x: 4, y: 5, z: 6 }, paletteId: 'green' })

		expect(replaced).toMatchObject({ changed: true })
		expect(placed.state.voxels.get(packCell({ x: 4, y: 5, z: 6 }))?.paletteId).toBe('red')
		expect(replaced.state.voxels.get(packCell({ x: 4, y: 5, z: 6 }))?.paletteId).toBe('green')
	})

	it('erases occupied cells and keeps the previous state immutable', () => {
		const placed = placeVoxel(createEmptyVoxelEditorState(), { cell: { x: 2, y: 3, z: 4 }, paletteId: 'orange' })
		const erased = eraseVoxel(placed.state, { cell: { x: 2, y: 3, z: 4 } })

		expect(erased).toMatchObject({ changed: true })
		expect(placed.state.voxels.size).toBe(1)
		expect(erased.state.voxels.size).toBe(0)
	})

	it('does not erase empty or out-of-bounds cells', () => {
		const initialState = createEmptyVoxelEditorState()

		expect(eraseVoxel(initialState, { cell: { x: 2, y: 3, z: 4 } })).toEqual({
			state: initialState,
			changed: false,
			reason: 'empty-cell',
		})
		expect(eraseVoxel(initialState, { cell: { x: 2, y: 16, z: 4 } })).toEqual({
			state: initialState,
			changed: false,
			reason: 'out-of-bounds',
		})
	})

	it('paints occupied cells only when the palette changes', () => {
		const placed = placeVoxel(createEmptyVoxelEditorState(), { cell: { x: 7, y: 8, z: 9 }, paletteId: 'white' })
		const painted = paintVoxel(placed.state, { cell: { x: 7, y: 8, z: 9 }, paletteId: 'black' })
		const repeated = paintVoxel(painted.state, { cell: { x: 7, y: 8, z: 9 }, paletteId: 'black' })

		expect(painted).toMatchObject({ changed: true })
		expect(placed.state.voxels.get(packCell({ x: 7, y: 8, z: 9 }))?.paletteId).toBe('white')
		expect(painted.state.voxels.get(packCell({ x: 7, y: 8, z: 9 }))?.paletteId).toBe('black')
		expect(repeated).toEqual({ state: painted.state, changed: false, reason: 'same-palette' })
	})

	it('does not paint empty or out-of-bounds cells', () => {
		const initialState = createEmptyVoxelEditorState()

		expect(paintVoxel(initialState, { cell: { x: 0, y: 0, z: 0 }, paletteId: 'purple' })).toEqual({
			state: initialState,
			changed: false,
			reason: 'empty-cell',
		})
		expect(paintVoxel(initialState, { cell: { x: 0, y: 0, z: -1 }, paletteId: 'purple' })).toEqual({
			state: initialState,
			changed: false,
			reason: 'out-of-bounds',
		})
	})
})
