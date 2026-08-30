import { describe, expect, it } from 'vitest'

import { assert } from './error'

describe('assert', () => {
	it('throws when an invariant is false', () => {
		expect(() => assert(false, 'broken')).toThrow('broken')
	})
})
