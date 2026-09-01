import type { InstancedMesh, Material } from 'three'
import type { VoxelRenderInstance } from './voxel-rendering'
import { Color, InstancedBufferAttribute, Object3D } from 'three'

export function createVoxelInstanceColorAttribute(instanceCount: number) {
	return new InstancedBufferAttribute(new Float32Array(instanceCount * 3).fill(1), 3)
}

export function syncInstancedVoxelTransforms(mesh: InstancedMesh, instances: ReadonlyArray<VoxelRenderInstance>) {
	const transform = new Object3D()
	instances.forEach((instance, instanceId) => {
		transform.position.set(...instance.position)
		transform.updateMatrix()
		mesh.setMatrixAt(instanceId, transform.matrix)
	})

	mesh.count = instances.length
	mesh.instanceMatrix.needsUpdate = true
}

export function syncInstancedVoxelMesh(mesh: InstancedMesh, instances: ReadonlyArray<VoxelRenderInstance>) {
	const color = new Color()
	const hadInstanceColor = mesh.instanceColor !== null
	instances.forEach((instance, instanceId) => {
		mesh.setColorAt(instanceId, color.set(instance.color))
	})

	syncInstancedVoxelTransforms(mesh, instances)
	if (mesh.instanceColor !== null) {
		mesh.instanceColor.needsUpdate = true
	}
	if (!hadInstanceColor && mesh.instanceColor !== null) {
		markMaterialForRecompile(mesh.material)
	}
}

function markMaterialForRecompile(material: Material | Array<Material>) {
	if (Array.isArray(material)) {
		material.forEach(markMaterialForRecompile)
		return
	}

	material.needsUpdate = true
}
