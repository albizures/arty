import type { NextApiRequest, NextApiResponse } from 'next'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
	handle: vi.fn(),
	RPCHandler: vi.fn(function RPCHandler(this: { handle: unknown }) {
		this.handle = mocks.handle
	}),
}))

vi.mock('@orpc/server/node', () => ({
	RPCHandler: mocks.RPCHandler,
}))

describe('oRPC API handler', () => {
	beforeEach(() => {
		vi.resetModules()
		mocks.handle.mockReset()
		mocks.RPCHandler.mockClear()
	})

	it('disables Next body parsing for streaming RPC requests', async () => {
		const {config} = await import('../../../../src/pages/api/rpc/[...path]')
		expect(config).toEqual({ api: { bodyParser: false } })
	})

	it('delegates matched requests to the RPC handler', async () => {
		mocks.handle.mockResolvedValueOnce({ matched: true })
		const { default: handleORPC} = await import('../../../../src/pages/api/rpc/[...path]')
		const req = {} as NextApiRequest
		const res = response()

		await handleORPC(req, res)

		expect(mocks.RPCHandler).toHaveBeenCalledTimes(1)
		expect(mocks.handle).toHaveBeenCalledWith(req, res, { prefix: '/api/rpc' })
		expect(res.status).not.toHaveBeenCalled()
	})

	it('returns a 404 when no RPC route matches', async () => {
		mocks.handle.mockResolvedValueOnce({ matched: false })
		const { default: handleORPC} = await import('../../../../src/pages/api/rpc/[...path]')
		const req = {} as NextApiRequest
		const res = response()

		await handleORPC(req, res)

		expect(res.status).toHaveBeenCalledWith(404)
		expect(res.end).toHaveBeenCalledWith('Not found')
	})
})

function response(): NextApiResponse {
	const res = {
		status: vi.fn(() => res),
		end: vi.fn(() => res),
	} as unknown as NextApiResponse

	return res
}
