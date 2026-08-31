import { existsSync, readFileSync } from 'node:fs'

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import Home from './index'

describe('home comparison page', () => {
	it('renders the fixed blind comparison trial without exposing renderer identities', () => {
		const html = renderToStaticMarkup(<Home />)

		expect(html).toContain('Phase 0 blind comparison')
		expect(html).toContain('Fixture: chest · Elevation: elev26 · Output: 64px')
		expect(html).toContain('Directions: front-right, back-right, back-left, front-left')
		expect(html).toContain('aria-label="Blind comparison trial chest__elev26__64"')
		expect(html).toContain('<h2>Variant A</h2>')
		expect(html).toContain('<h2>Variant B</h2>')
		expect(html).toContain('<h2>Variant C</h2>')
		expect(html).not.toContain('baseline')
		expect(html).not.toContain('conservative')
		expect(html).not.toContain('full')
	})

	it('renders actual-size and nearest-neighbor preview images from the same blind artifact paths', () => {
		const html = renderToStaticMarkup(<Home />)

		expect(html).toContain('src="/phase-0/blind-artifacts/chest__elev26__64__A__front-right.png"')
		expect(html).toContain('alt="Variant A front-right actual-size preview"')
		expect(html).toContain('alt="Variant A front-right 4x nearest-neighbor preview"')
		expect(html).toContain('width="64"')
		expect(html).toContain('height="64"')
		expect(html).toContain('width="256"')
		expect(html).toContain('height="256"')
		expect(html).toContain('style="display:block;image-rendering:auto"')
		expect(html).toContain('style="display:block;image-rendering:pixelated"')
		expect(html.match(/src="\/phase-0\/blind-artifacts\/chest__elev26__64__A__front-right\.png"/g)).toHaveLength(2)
	})

	it('serves every rendered preview source as a public PNG file', () => {
		const html = renderToStaticMarkup(<Home />)
		const imageSources = [...html.matchAll(/src="([^"]+)"/g)].map((match) => match[1]!)
		const uniqueImageSources = [...new Set(imageSources)]

		expect(uniqueImageSources).toHaveLength(12)
		for (const imageSource of uniqueImageSources) {
			const publicPath = `public${imageSource}`
			expect(existsSync(publicPath), `${imageSource} should be a public static asset`).toBe(true)
			expect([...readFileSync(publicPath).subarray(0, 8)], `${imageSource} should be a PNG`).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
		}
	})

	it('renders page-only transparency inspection controls and rejected product features', () => {
		const html = renderToStaticMarkup(<Home />)

		expect(html).toContain('Transparency inspection background')
		expect(html).toContain('style="display:inline-block;margin-right:12px"')
		expect(html).toContain('background-color:#ffffff')
		expect(html).toContain('background-size:16px 16px')
		expect(html.match(/name="inspection-background"/g)).toHaveLength(3)
		expect(html.match(/checked=""/g)).toHaveLength(1)
		expect(html).toContain('type="radio" name="inspection-background" checked=""')
		expect(html).toContain('checkerboard')
		expect(html).toContain('Inspection backgrounds are page-only CSS behind the same PNG files; exported artifact pixels are unchanged.')
		expect(html).toContain('voxel-editing is out of scope for the Phase 0 comparison page.')
		expect(html).toContain('generalized-asset-browsing is out of scope for the Phase 0 comparison page.')
		expect(html).toContain('This remains an intentionally unpolished Phase 0 evidence surface, not the MVP editor.')
	})
})
