import type { NextApiRequest, NextApiResponse } from 'next'
import { RPCHandler } from '@orpc/server/node'
import { router } from '../../../server/router'

const handler = new RPCHandler(router)

export const config = {
	api: {
		bodyParser: false,
	},
}

export default async function handleORPC(req: NextApiRequest, res: NextApiResponse) {
	const { matched } = await handler.handle(req, res, { prefix: '/api/rpc' })

	if (!matched) {
		res.status(404).end('Not found')
	}
}
