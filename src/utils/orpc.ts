import type { RouterClient } from '@orpc/server'
import type { router } from '../server/router'
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'

const link = new RPCLink({
  url: '/api/rpc',
})

export const orpc: RouterClient<typeof router> = createORPCClient(link)
