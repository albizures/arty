import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Home from '../../../src/pages/index'

describe('home voxel editor page', () => {
	it('renders the client-only voxel editor loading shell during server render', () => {
		const html = renderToStaticMarkup(<Home />)

		expect(html).toContain('Loading voxel editor')
		expect(html).toContain('min-height:100vh')
		expect(html).toContain('background:#0f172a')
		expect(html).toContain('color:#dbeafe')
		expect(html).not.toContain('Phase 0 blind comparison')
	})
})
