import { describe, expect, it } from 'vitest'

import { failure, fromSyncThrowable, fromThrowable, success } from './result'

describe('result helpers', () => {
	it('constructs failures with and without classified errors', () => {
		const error = new Error('boom')

		expect(failure('invalid-input', { reason: 'missing' })).toEqual({
			kind: 'invalid-input',
			data: { reason: 'missing' },
		})
		expect(failure('source-failed', undefined, error)).toEqual({
			kind: 'source-failed',
			data: undefined,
			error,
		})
	})

	it('maps synchronous throwing and successful calls', () => {
		const divide = fromSyncThrowable(
			(numerator: number, denominator: number) => {
				if (denominator === 0) {
					throw new Error('zero')
				}

				return numerator / denominator
			},
			(output, error) => {
				if (error !== undefined) {
					return failure('division-failed', undefined, error as Error)
				}

				return success('divided', output)
			},
		)

		expect(divide({ args: [6, 2] })).toEqual(success('divided', 3))
		expect(divide({ args: [6, 0] }).kind).toBe('division-failed')
	})

	it('maps asynchronous throwing and successful calls', async () => {
		const load = fromThrowable(
			async (shouldThrow: boolean) => {
				if (shouldThrow) {
					throw new Error('nope')
				}

				return 'loaded'
			},
			(output, error) => {
				if (error !== undefined) {
					return failure('load-failed', undefined, error as Error)
				}

				return success('loaded', output)
			},
		)

		await expect(load({ args: [false] })).resolves.toEqual(success('loaded', 'loaded'))
		expect((await load({ args: [true] })).kind).toBe('load-failed')
	})
})
