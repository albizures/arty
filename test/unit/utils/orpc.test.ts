import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
	createORPCClient: vi.fn((link: unknown) => ({ link })),
	RPCLink: vi.fn(function RPCLink(this: { options: unknown }, options: unknown) {
		this.options = options
	}),
}))

vi.mock('@orpc/client', () => ({
	createORPCClient: mocks.createORPCClient,
}))

vi.mock('@orpc/client/fetch', () => ({
	RPCLink: mocks.RPCLink,
}))

describe('orpc client', () => {
	beforeEach(() => {
		vi.resetModules()
		mocks.createORPCClient.mockClear()
		mocks.RPCLink.mockClear()
	})

	it('creates a browser RPC client pointed at the API route', async () => {
		const { orpc } = await import('../../../src/utils/orpc')
		expect(mocks.RPCLink).toHaveBeenCalledWith({ url: '/api/rpc' })
		expect(mocks.createORPCClient).toHaveBeenCalledTimes(1)
		expect(orpc).toEqual({ link: mocks.RPCLink.mock.instances[0] })
	})
})
