import { existsSync, readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Home from '../../../src/pages/index'

describe('home comparison page', () => {
	it('renders the fixed blind comparison trial without exposing renderer identities', () => {
		const html = renderToStaticMarkup(<Home />)

		expect(html).toContain('Phase 0 blind comparison')
	})
})
