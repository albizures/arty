import { describe, expect, it } from 'vitest'

import { assert } from '../../../src/utils/error'

describe('assert', () => {
	it('throws when an invariant is false', () => {
		expect(() => assert(false, 'broken')).toThrow('broken')
	})

	it('should not throw when an invariant is true', () => {
		expect(() => assert(true, 'good')).not.toThrow('broken')
	})

})
