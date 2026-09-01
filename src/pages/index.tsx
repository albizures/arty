import dynamic from 'next/dynamic'

const VoxelEditorShell = dynamic(
	/* v8 ignore next -- Next invokes the client-only island loader in the browser. */
	async () => {
		const { VoxelEditorShell } = await import('../components/voxel-editor/voxel-editor-shell')
		return VoxelEditorShell
	},
	{
		ssr: false,
		loading: () => (
			<main style={{ minHeight: '100vh', background: '#0f172a', color: '#dbeafe' }}>
				Loading voxel editor…
			</main>
		),
	},
)

export default function Home() {
	return <VoxelEditorShell />
}
