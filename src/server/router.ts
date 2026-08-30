import { os } from '@orpc/server'
import * as z from 'zod'

export const listPlanets = os.handler(async () => [
  { id: 1, name: 'Earth' },
  { id: 2, name: 'Mars' },
])

export const findPlanet = os
  .input(z.object({ id: z.number() }))
  .handler(async ({ input }) => ({ id: input.id, name: input.id === 2 ? 'Mars' : 'Earth' }))

export const createPlanet = os
  .input(z.object({ name: z.string(), description: z.string().optional() }))
  .handler(async ({ input }) => ({ id: 3, ...input }))

export const router = {
  planet: {
    list: listPlanets,
    find: findPlanet,
    create: createPlanet,
  },
}
