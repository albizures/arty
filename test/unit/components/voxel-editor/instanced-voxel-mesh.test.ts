import { BoxGeometry, Color, InstancedMesh, MeshStandardMaterial } from 'three'
import { describe, expect, it } from 'vitest'
import { createVoxelInstanceColorAttribute, syncInstancedVoxelMesh } from '../../../../src/components/voxel-editor/instanced-voxel-mesh'

describe('instanced voxel mesh sync', () => {
	it('creates a white instance color attribute up front so the first shader compile supports instance colors', () => {
		const attribute = createVoxelInstanceColorAttribute(2)

		expect(attribute.itemSize).toBe(3)
		expect(Array.from(attribute.array)).toEqual([1, 1, 1, 1, 1, 1])
	})

	it('creates instance colors and forces the material shader to recompile for them', () => {
		const material = new MeshStandardMaterial()
		const mesh = new InstancedMesh(new BoxGeometry(), material, 2)

		syncInstancedVoxelMesh(mesh, [
			{ packedCell: 1, position: [1.5, 0.5, 0.5], color: '#3b82f6' },
			{ packedCell: 2, position: [2.5, 0.5, 0.5], color: '#ef4444' },
		])

		expect(mesh.count).toBe(2)
		expect(mesh.instanceColor).not.toBeNull()
		expect(mesh.instanceColor?.version).toBe(1)
		expect(material.version).toBe(1)
		const expectedColorComponents = [
			...new Color('#3b82f6').toArray(),
			...new Color('#ef4444').toArray(),
		]
		expect(Array.from(mesh.instanceColor?.array ?? [])).toHaveLength(expectedColorComponents.length)
		expectedColorComponents.forEach((expectedComponent, index) => {
			expect(mesh.instanceColor?.array[index]).toBeCloseTo(expectedComponent)
		})
	})

	it('leaves instance colors absent when there are no render instances', () => {
		const material = new MeshStandardMaterial()
		const mesh = new InstancedMesh(new BoxGeometry(), material, 1)

		syncInstancedVoxelMesh(mesh, [])

		expect(mesh.count).toBe(0)
		expect(mesh.instanceColor).toBeNull()
		expect(material.version).toBe(0)
	})

	it('recompiles every material when a multi-material mesh gets instance colors', () => {
		const materials = [new MeshStandardMaterial(), new MeshStandardMaterial()]
		const mesh = new InstancedMesh(new BoxGeometry(), materials, 1)

		syncInstancedVoxelMesh(mesh, [
			{ packedCell: 1, position: [1.5, 0.5, 0.5], color: '#3b82f6' },
		])

		expect(materials.map((material) => material.version)).toEqual([1, 1])
	})

	it('does not recompile a material that already had instance colors', () => {
		const material = new MeshStandardMaterial()
		const mesh = new InstancedMesh(new BoxGeometry(), material, 1)

		syncInstancedVoxelMesh(mesh, [
			{ packedCell: 1, position: [1.5, 0.5, 0.5], color: '#3b82f6' },
		])
		syncInstancedVoxelMesh(mesh, [
			{ packedCell: 1, position: [1.5, 0.5, 0.5], color: '#ef4444' },
		])

		expect(material.version).toBe(1)
	})
})
