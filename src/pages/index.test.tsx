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

	it('renders official blind trial response controls for ranking, none-usable, defects, and cleanup notes', () => {
		const html = renderToStaticMarkup(<Home />)

		expect(html).toContain('aria-label="Blind comparison response chest__elev26__64"')
		expect(html).toContain('Rank A/B/C by most usable as pixel-art game prop sprites')
		expect(html).toContain('Rank 1:')
		expect(html).toContain('Rank 2:')
		expect(html).toContain('Rank 3:')
		expect(html.match(/name="rank-chest__elev26__64-/g)).toHaveLength(3)
		expect(html.match(/<option value="[ABC]">Variant [ABC]<\/option>/g)).toHaveLength(9)
		expect(html).toContain('No option is usable')
		expect(html).toContain('name="none-usable-chest__elev26__64"')
		expect(html).toContain('Observed defects for the whole trial')
		expect(html).toContain('Observed defects for variant A')
		expect(html).toContain('Observed defects for variant B')
		expect(html).toContain('Observed defects for variant C')
		expect(html).toContain('name="defects-chest__elev26__64-trial"')
		expect(html).toContain('name="defects-chest__elev26__64-A"')
		expect(html).toContain('name="defects-chest__elev26__64-C"')
		expect(html).toContain('value="weak-or-unclear-silhouette"')
		expect(html).toContain(' weak-or-unclear-silhouette')
		expect(html).toContain('value="other-free-text"')
		expect(html).toContain('Short cleanup notes')
		expect(html).toContain('name="cleanup-notes-chest__elev26__64"')
		expect(html).toContain('maxLength="500"')
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
