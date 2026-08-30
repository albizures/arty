import { useState } from 'react'
import { orpc } from '../utils/orpc'

export default function Home() {
	const [message, setMessage] = useState('Click the button to call oRPC.')

	async function loadPlanets() {
		const planets = await orpc.planet.list()
		setMessage(`Loaded ${planets.map((planet) => planet.name).join(', ')} from oRPC.`)
	}

	return (
		<main>
			<h1>Arty</h1>
			<p>Next.js is running with the Pages Router.</p>
			<button type="button" onClick={loadPlanets}>Call oRPC</button>
			<p>{message}</p>
		</main>
	)
}
