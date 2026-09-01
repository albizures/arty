/* v8 ignore file -- React Three Fiber scene coverage is enforced by focused render-contract and helper tests. */
/* Stryker disable all -- The shell is React Three Fiber JSX and event wiring; focused render-contract tests cover its user-facing HUD/loading contract while domain, interaction, and rendering behavior stay mutation-tested at pure seams. */
import type { ThreeEvent } from '@react-three/fiber'
import type { InstancedMesh } from 'three'
import type { Cell, PaletteId, VoxelEditorState } from '../../domain/voxel-editor'
import type { HoverPreview, VoxelEditTool } from './voxel-interaction'
import { Grid, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
	createEmptyVoxelEditorState,
	eraseVoxel,
	GRID_CELL_COUNT,
	neighborOf,
	paintVoxel,
	placeVoxel,
	unpackCell,
} from '../../domain/voxel-editor'
import { syncInstancedVoxelTransforms } from './instanced-voxel-mesh'
import { faceDirectionFromNormal, floorHoverPreview, floorPointToCell, occupiedVoxelPreview } from './voxel-interaction'
import { deriveVoxelRenderInstances, voxelPalette } from './voxel-rendering'

const cameraPosition: [number, number, number] = [20, 15, 22]
const cameraTarget: [number, number, number] = [8, 3, 8]

const paletteIds = Object.keys(voxelPalette) as Array<PaletteId>

export function VoxelEditorShell() {
	const [state, setState] = useState(createDemoVoxelEditorState)
	const [selectedTool, setSelectedTool] = useState<VoxelEditTool>('place')
	const [selectedPaletteId, setSelectedPaletteId] = useState<PaletteId>('blue')
	const [hoverPreview, setHoverPreview] = useState<HoverPreview | undefined>()

	function applyCommand(result: { state: VoxelEditorState, changed: boolean }) {
		if (result.changed) {
			setState(result.state)
		}
	}

	function editOccupiedVoxel(event: ThreeEvent<MouseEvent>, packedCellsByInstanceId: ReadonlyArray<number>) {
		event.stopPropagation()
		const instanceId = event.instanceId
		if (instanceId === undefined) {
			return
		}

		const packedCell = packedCellsByInstanceId[instanceId]
		if (packedCell === undefined) {
			return
		}

		const cell = unpackCell(packedCell)
		if (selectedTool === 'erase') {
			applyCommand(eraseVoxel(state, { cell }))
			return
		}

		if (selectedTool === 'paint') {
			applyCommand(paintVoxel(state, { cell, paletteId: selectedPaletteId }))
			return
		}

		const faceDirection = event.face == null ? undefined : faceDirectionFromNormal(event.face.normal)
		const targetCell = faceDirection === undefined ? undefined : neighborOf(cell, faceDirection)
		if (targetCell !== undefined) {
			applyCommand(placeVoxel(state, { cell: targetCell, paletteId: selectedPaletteId }))
		}
	}

	function previewOccupiedVoxel(event: ThreeEvent<PointerEvent>, packedCellsByInstanceId: ReadonlyArray<number>) {
		event.stopPropagation()
		setHoverPreview(occupiedVoxelPreview({
			faceNormal: event.face?.normal,
			instanceId: event.instanceId,
			packedCellsByInstanceId,
			paletteId: selectedPaletteId,
			tool: selectedTool,
		}))
	}

	function previewFloor(event: ThreeEvent<PointerEvent>) {
		setHoverPreview(floorHoverPreview({
			paletteId: selectedPaletteId,
			point: event.point,
			tool: selectedTool,
		}))
	}

	function clearHoverPreview() {
		setHoverPreview(undefined)
	}

	function placeOnFloor(event: ThreeEvent<MouseEvent>) {
		if (selectedTool !== 'place') {
			return
		}

		const cell = floorPointToCell(event.point)
		if (cell !== undefined) {
			applyCommand(placeVoxel(state, { cell, paletteId: selectedPaletteId }))
		}
	}

	return (
		<main className="voxelEditorShell">
			<section className="canvasStage" aria-label="Voxel editor 3D workspace">
				<Canvas camera={{ position: cameraPosition, fov: 45 }} shadows>
					<color attach="background" args={['#0f172a']} />
					<hemisphereLight args={['#dbeafe', '#1e293b', 0.72]} />
					<ambientLight intensity={0.34} />
					<directionalLight position={[10, 16, 8]} intensity={1.35} castShadow />
					<pointLight position={[-6, 7, -6]} intensity={0.35} />
					<VoxelSceneReference onFloorClick={placeOnFloor} onFloorOut={clearHoverPreview} onFloorPointerMove={previewFloor} />
					<InstancedVoxels
						onVoxelClick={editOccupiedVoxel}
						onVoxelOut={clearHoverPreview}
						onVoxelPointerMove={previewOccupiedVoxel}
						state={state}
					/>
					<HoverPreviewMarker preview={hoverPreview} />
					<OrbitControls makeDefault enableDamping dampingFactor={0.08} target={cameraTarget} />
				</Canvas>
			</section>

			<div className="hudTop">Voxel Editor · click cubes or the floor to build in a fixed 16×16×16 space</div>
			<aside className="hudTools card" aria-label="Voxel edit tools">
				<strong>Tools</strong>
				<div className="buttonRow">
					{(['place', 'paint', 'erase'] as const).map((tool) => (
						<button
							key={tool}
							aria-pressed={selectedTool === tool}
							className={selectedTool === tool ? 'selected' : undefined}
							type="button"
							onClick={() => setSelectedTool(tool)}
						>
							{tool}
						</button>
					))}
				</div>
			</aside>
			<aside className="hudPalette card" aria-label="Voxel color palette">
				<strong>Palette</strong>
				<div className="swatches">
					{paletteIds.map((paletteId) => (
						<button
							key={paletteId}
							aria-label={`Select ${paletteId}`}
							aria-pressed={selectedPaletteId === paletteId}
							className={selectedPaletteId === paletteId ? 'selected' : undefined}
							style={{ background: voxelPalette[paletteId] }}
							type="button"
							onClick={() => setSelectedPaletteId(paletteId)}
						/>
					))}
				</div>
			</aside>
			<aside className="hudState card" aria-label="Voxel editor state">
				<strong>State</strong>
				<span>
					{state.voxels.size}
					{' '}
					voxels
				</span>
				<span>
					Tool:
					{selectedTool}
				</span>
				<span>
					Color:
					{selectedPaletteId}
				</span>
			</aside>
			<aside className="hudHelp card" aria-label="Camera controls help">
				<strong>How to play</strong>
				<ul>
					<li>Place: click floor or cube face</li>
					<li>Paint/erase: click a cube</li>
					<li>Left drag orbit · right drag pan · wheel zoom</li>
				</ul>
			</aside>

			{/* eslint-disable-next-line ts/no-use-before-define */}
			<style jsx global>{styles}</style>
		</main>
	)
}

type InstancedVoxelsProps = {
	onVoxelClick: (event: ThreeEvent<MouseEvent>, packedCellsByInstanceId: ReadonlyArray<number>) => void
	onVoxelOut: () => void
	onVoxelPointerMove: (event: ThreeEvent<PointerEvent>, packedCellsByInstanceId: ReadonlyArray<number>) => void
	state: VoxelEditorState
}

function InstancedVoxels(props: InstancedVoxelsProps) {
	const {
		onVoxelClick,
		onVoxelOut,
		onVoxelPointerMove,
		state,
	} = props
	const renderGroups = useMemo(() => paletteIds
		.map((paletteId) => ({
			paletteId,
			...deriveVoxelRenderInstances({
				voxels: new Map(Array.from(state.voxels).filter(([, voxel]) => voxel.paletteId === paletteId)),
			}),
		}))
		.filter((group) => group.instances.length > 0), [state])

	return (
		<>
			{renderGroups.map((group) => (
				<InstancedVoxelGroup
					key={group.paletteId}
					color={voxelPalette[group.paletteId]}
					instances={group.instances}
					onVoxelClick={onVoxelClick}
					onVoxelOut={onVoxelOut}
					onVoxelPointerMove={onVoxelPointerMove}
					packedCellsByInstanceId={group.packedCellsByInstanceId}
				/>
			))}
		</>
	)
}

type InstancedVoxelGroupProps = {
	color: string
	instances: ReturnType<typeof deriveVoxelRenderInstances>['instances']
	onVoxelClick: (event: ThreeEvent<MouseEvent>, packedCellsByInstanceId: ReadonlyArray<number>) => void
	onVoxelOut: () => void
	onVoxelPointerMove: (event: ThreeEvent<PointerEvent>, packedCellsByInstanceId: ReadonlyArray<number>) => void
	packedCellsByInstanceId: ReadonlyArray<number>
}

function InstancedVoxelGroup({
	color,
	instances,
	onVoxelClick,
	onVoxelOut,
	onVoxelPointerMove,
	packedCellsByInstanceId,
}: InstancedVoxelGroupProps) {
	const meshRef = useRef<InstancedMesh>(null)

	useLayoutEffect(() => {
		const mesh = meshRef.current
		if (mesh === null) {
			return
		}

		syncInstancedVoxelTransforms(mesh, instances)
	}, [instances])

	return (
		<instancedMesh
			ref={meshRef}
			args={[undefined, undefined, GRID_CELL_COUNT]}
			castShadow
			receiveShadow
			userData={{ packedCellsByInstanceId }}
			onClick={(event) => onVoxelClick(event, packedCellsByInstanceId)}
			onPointerMove={(event) => onVoxelPointerMove(event, packedCellsByInstanceId)}
			onPointerOut={onVoxelOut}
		>
			<boxGeometry args={[1, 1, 1]} />
			<meshStandardMaterial color={color} metalness={0.05} roughness={0.72} />
		</instancedMesh>
	)
}

function VoxelSceneReference({
	onFloorClick,
	onFloorOut,
	onFloorPointerMove,
}: {
	onFloorClick: (event: ThreeEvent<MouseEvent>) => void
	onFloorOut: () => void
	onFloorPointerMove: (event: ThreeEvent<PointerEvent>) => void
}) {
	return (
		<group>
			<Grid
				args={[16, 16]}
				cellColor="#38bdf8"
				cellSize={1}
				cellThickness={0.55}
				fadeDistance={32}
				fadeStrength={0.7}
				position={[8, -0.01, 8]}
				sectionColor="#93c5fd"
				sectionSize={4}
				sectionThickness={1.1}
			/>
			<mesh
				receiveShadow
				rotation={[-Math.PI / 2, 0, 0]}
				position={[8, -0.02, 8]}
				onClick={onFloorClick}
				onPointerMove={onFloorPointerMove}
				onPointerOut={onFloorOut}
			>
				<planeGeometry args={[16, 16]} />
				<meshStandardMaterial color="#172554" opacity={0.18} transparent />
			</mesh>
		</group>
	)
}

function HoverPreviewMarker({ preview }: { preview?: HoverPreview }) {
	if (preview === undefined) {
		return null
	}

	const position = [preview.cell.x + 0.5, preview.cell.y + 0.5, preview.cell.z + 0.5] as const
	const color = preview.paletteId === undefined ? '#f87171' : voxelPalette[preview.paletteId]

	if (preview.kind === 'ghost') {
		return (
			<mesh position={position}>
				<boxGeometry args={[1, 1, 1]} />
				<meshStandardMaterial color={color} opacity={0.34} transparent />
			</mesh>
		)
	}

	return (
		<mesh position={position} scale={1.04}>
			<boxGeometry args={[1, 1, 1]} />
			<meshBasicMaterial color={color} toneMapped={false} wireframe />
		</mesh>
	)
}

function createDemoVoxelEditorState(): VoxelEditorState {
	const seedVoxels: ReadonlyArray<{ cell: Cell, paletteId: PaletteId }> = [
		{ cell: { x: 5, y: 0, z: 6 }, paletteId: 'blue' },
		{ cell: { x: 6, y: 0, z: 6 }, paletteId: 'blue' },
		{ cell: { x: 7, y: 0, z: 6 }, paletteId: 'blue' },
		{ cell: { x: 8, y: 0, z: 6 }, paletteId: 'blue' },
		{ cell: { x: 9, y: 0, z: 6 }, paletteId: 'blue' },
		{ cell: { x: 10, y: 0, z: 6 }, paletteId: 'blue' },
		{ cell: { x: 5, y: 0, z: 7 }, paletteId: 'blue' },
		{ cell: { x: 10, y: 0, z: 7 }, paletteId: 'blue' },
		{ cell: { x: 5, y: 0, z: 8 }, paletteId: 'blue' },
		{ cell: { x: 6, y: 0, z: 8 }, paletteId: 'blue' },
		{ cell: { x: 7, y: 0, z: 8 }, paletteId: 'blue' },
		{ cell: { x: 8, y: 0, z: 8 }, paletteId: 'blue' },
		{ cell: { x: 9, y: 0, z: 8 }, paletteId: 'blue' },
		{ cell: { x: 10, y: 0, z: 8 }, paletteId: 'blue' },
		{ cell: { x: 6, y: 1, z: 7 }, paletteId: 'white' },
		{ cell: { x: 9, y: 1, z: 7 }, paletteId: 'white' },
		{ cell: { x: 6, y: 2, z: 7 }, paletteId: 'green' },
		{ cell: { x: 9, y: 2, z: 7 }, paletteId: 'green' },
		{ cell: { x: 7, y: 1, z: 8 }, paletteId: 'orange' },
		{ cell: { x: 8, y: 1, z: 8 }, paletteId: 'orange' },
		{ cell: { x: 7, y: 2, z: 8 }, paletteId: 'red' },
		{ cell: { x: 8, y: 2, z: 8 }, paletteId: 'red' },
		{ cell: { x: 4, y: 0, z: 10 }, paletteId: 'purple' },
		{ cell: { x: 11, y: 0, z: 10 }, paletteId: 'yellow' },
	]

	return seedVoxels.reduce(
		(state, command) => placeVoxel(state, command).state,
		createEmptyVoxelEditorState(),
	)
}

const styles = `
	body { margin: 0; background: #0f172a; color: #e2e8f0; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
	.voxelEditorShell { position: relative; min-height: 100vh; overflow: hidden; background: #0f172a; }
	.canvasStage { position: fixed; inset: 0; }
	.hudTop { position: absolute; top: 24px; left: 50%; transform: translateX(-50%); z-index: 2; max-width: min(760px, calc(100vw - 48px)); padding: 10px 18px; border-radius: 999px; background: rgba(2, 6, 23, .72); border: 1px solid rgba(147, 197, 253, .28); color: #dbeafe; text-align: center; box-shadow: 0 18px 60px rgba(0, 0, 0, .24); }
	.card { z-index: 2; background: rgba(15, 23, 42, .86); border: 1px solid rgba(148, 163, 184, .28); border-radius: 18px; box-shadow: 0 18px 60px rgba(0, 0, 0, .28); backdrop-filter: blur(14px); }
	.hudTools { position: absolute; left: 28px; bottom: 32px; display: grid; gap: 8px; padding: 14px 16px; }
	.hudPalette { position: absolute; left: 50%; bottom: 32px; transform: translateX(-50%); display: grid; gap: 10px; padding: 14px 16px; text-align: center; }
	.hudHelp { position: absolute; right: 28px; top: 84px; width: 260px; padding: 16px 18px; }
	.hudState { position: absolute; right: 28px; bottom: 32px; display: grid; gap: 4px; min-width: 132px; padding: 14px 16px; color: #cbd5e1; }
	.hudHelp ul { margin: 10px 0 0; padding-left: 18px; color: #cbd5e1; line-height: 1.55; }
	.buttonRow { display: flex; gap: 8px; }
	.buttonRow button { border: 1px solid rgba(147, 197, 253, .36); border-radius: 999px; padding: 7px 11px; background: rgba(15, 23, 42, .8); color: #dbeafe; text-transform: capitalize; cursor: pointer; }
	.buttonRow button.selected { background: #2563eb; border-color: #93c5fd; color: white; }
	.swatches { display: flex; gap: 8px; }
	.swatches button { display: block; width: 28px; height: 28px; border-radius: 9px; border: 2px solid rgba(248, 250, 252, .74); cursor: pointer; }
	.swatches button.selected { outline: 3px solid #f8fafc; outline-offset: 3px; }
`
