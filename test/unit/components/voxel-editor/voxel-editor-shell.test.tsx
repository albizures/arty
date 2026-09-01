import type { PropsWithChildren } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@react-three/fiber', () => ({
	Canvas: ({ camera, children, shadows }: PropsWithChildren<{ camera: unknown, shadows?: boolean }>) => (
		<div data-camera={JSON.stringify(camera)} data-shadows={String(shadows)}>{children}</div>
	),
}))

vi.mock('@react-three/drei', () => ({
	Grid: (props: Record<string, unknown>) => <div data-grid={JSON.stringify(props)} />,
	OrbitControls: (props: Record<string, unknown>) => <div data-orbit-controls={JSON.stringify(props)} />,
}))

const { VoxelEditorShell } = await import('../../../../src/components/voxel-editor/voxel-editor-shell')

describe('voxel editor shell', () => {
	it('renders the demo HUD with the initial tool, palette, and voxel count', () => {
		const html = renderToStaticMarkup(<VoxelEditorShell />)

		expect(html).toContain('aria-label="Voxel editor 3D workspace"')
		expect(html).toContain('Voxel Editor · click cubes or the floor')
		expect(html).toContain('<span>24 voxels</span>')
		expect(html).toContain('<span>Tool:place</span>')
		expect(html).toContain('<span>Color:blue</span>')
	})

	it('renders accessible tool and palette controls with the default selections pressed', () => {
		const html = renderToStaticMarkup(<VoxelEditorShell />)

		expect(html).toContain('<button aria-pressed="true" class="selected" type="button">place</button>')
		expect(html).toContain('<button aria-pressed="false" type="button">paint</button>')
		expect(html).toContain('<button aria-pressed="false" type="button">erase</button>')
		expect(html).toContain('aria-label="Select blue" aria-pressed="true"')
		expect(html).toContain('aria-label="Select red" aria-pressed="false"')
	})

	it('passes the voxel scene camera, grid, floor, and instance lookup contract to render primitives', () => {
		const html = renderToStaticMarkup(<VoxelEditorShell />)

		expect(html).toContain('&quot;position&quot;:[20,15,22]')
		expect(html).toContain('data-shadows="true"')
		expect(html).toContain('&quot;args&quot;:[16,16]')
		expect(html).toContain('&quot;cellSize&quot;:1')
		expect(html).toContain('&quot;target&quot;:[8,3,8]')
		expect(html).toContain('userData="[object Object]"')
		expect(html).toContain('color="#3b82f6"')
		expect(html).toContain('color="#ef4444"')
	})
})
