import { describe, expect, it } from 'vitest'

import { createPlanet, findPlanet, listPlanets, router } from './router'

type Handler = (context: { input: unknown }) => Promise<unknown>
type ProcedureInternals = {
	'~orpc': {
		handler: Handler
	}
}

function handlerFor(procedure: unknown): Handler {
	return (procedure as ProcedureInternals)['~orpc'].handler
}

describe('router', () => {
	it('lists, finds, and creates planets through the oRPC handlers', async () => {
		await expect(handlerFor(listPlanets)({ input: undefined })).resolves.toEqual([
			{ id: 1, name: 'Earth' },
			{ id: 2, name: 'Mars' },
		])
		await expect(handlerFor(findPlanet)({ input: { id: 1 } })).resolves.toEqual({ id: 1, name: 'Earth' })
		await expect(handlerFor(findPlanet)({ input: { id: 2 } })).resolves.toEqual({ id: 2, name: 'Mars' })
		await expect(handlerFor(createPlanet)({ input: { name: 'Venus', description: 'Cloudy' } })).resolves.toEqual({
			id: 3,
			name: 'Venus',
			description: 'Cloudy',
		})
	})

	it('exports the planet router', () => {
		expect(router).toEqual({
			planet: {
				list: listPlanets,
				find: findPlanet,
				create: createPlanet,
			},
		})
	})
})
