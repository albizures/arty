import type { CSSProperties } from 'react'

import type { ComparisonInspectionBackground } from '../domain/comparison-page-preview'

import { useState } from 'react'
import { OFFICIAL_BLIND_COMPARISON_TRIALS } from '../domain/comparison-evaluation-manifest'
import {
	COMPARISON_INSPECTION_BACKGROUND_OPTIONS,

	comparisonInspectionBackgroundStyle,
	comparisonPageTrialPreview,
	phase0ComparisonPageScopeDecision,
} from '../domain/comparison-page-preview'

const ARTIFACT_BASE_PATH = '/phase-0/blind-artifacts'
const FIXED_TRIAL = OFFICIAL_BLIND_COMPARISON_TRIALS[0]!

const pageStyles = {
	fontFamily: 'system-ui, sans-serif',
	padding: '24px',
} satisfies CSSProperties

const stimulusGridStyles = {
	display: 'grid',
	gap: '24px',
	gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
} satisfies CSSProperties

const artifactGridStyles = {
	display: 'grid',
	gap: '16px',
} satisfies CSSProperties

const previewPairStyles = {
	display: 'flex',
	alignItems: 'flex-start',
	gap: '12px',
} satisfies CSSProperties

const previewSurfaceBaseStyles = {
	display: 'inline-block',
	padding: '8px',
	border: '1px solid #888',
} satisfies CSSProperties

const rejectedPhase0Features = [
	'voxel-editing',
	'renderer-controls',
	'manual-2d-correction-tools',
	'account-session-systems',
	'product-grade-navigation',
	'generalized-asset-browsing',
] as const

export default function Home() {
	const [inspectionBackground, setInspectionBackground] = useState<ComparisonInspectionBackground>('checkerboard')
	const trial = comparisonPageTrialPreview(FIXED_TRIAL, { artifactBasePath: ARTIFACT_BASE_PATH })
	const previewSurfaceStyles = {
		...previewSurfaceBaseStyles,
		...comparisonInspectionBackgroundStyle(inspectionBackground),
	} satisfies CSSProperties

	return (
		<main style={pageStyles}>
			<h1>Phase 0 blind comparison</h1>
			<p>
				Fixture:
				{' '}
				{trial.context.fixture}
				{' · Elevation: '}
				{trial.context.elevation}
				{' · Output: '}
				{trial.context.outputSize}
				px
			</p>
			<p>
				Directions:
				{' '}
				{trial.context.directions.join(', ')}
			</p>
			<fieldset>
				<legend>Transparency inspection background</legend>
				{COMPARISON_INSPECTION_BACKGROUND_OPTIONS.map((background) => (
					<label key={background} style={{ display: 'inline-block', marginRight: '12px' }}>
						<input
							checked={inspectionBackground === background}
							name="inspection-background"
							/* v8 ignore start -- server-rendered page test covers the controls; browser event dispatch is exercised manually. */
							/* Stryker disable next-line ArrowFunction: React event wiring is not observable through the server-rendered page seam. */
							onChange={() => setInspectionBackground(background)}
							/* v8 ignore stop */
							type="radio"
						/>
						{` ${background}`}
					</label>
				))}
			</fieldset>
			<p>
				Inspection backgrounds are page-only CSS behind the same PNG files; exported artifact pixels are unchanged.
			</p>
			<section aria-label={`Blind comparison trial ${trial.trialId}`} style={stimulusGridStyles}>
				{trial.stimulusSets.map((stimulusSet) => (
					<article key={stimulusSet.blindLabel}>
						<h2>{`Variant ${stimulusSet.blindLabel}`}</h2>
						<div style={artifactGridStyles}>
							{stimulusSet.artifacts.map((artifact) => (
								/* Stryker disable next-line StringLiteral: React list key is reconciliation wiring, not rendered page behavior. */
								<section key={`${stimulusSet.blindLabel}-${artifact.direction}`}>
									<h3>{artifact.direction}</h3>
									<div style={previewPairStyles}>
										<figure>
											<div style={previewSurfaceStyles}>
												<img
													alt={`Variant ${stimulusSet.blindLabel} ${artifact.direction} actual-size preview`}
													height={artifact.actualSize.height}
													src={artifact.actualSize.artifactPath}
													style={{ display: 'block', imageRendering: artifact.actualSize.imageRendering }}
													width={artifact.actualSize.width}
												/>
											</div>
											<figcaption>Actual size</figcaption>
										</figure>
										<figure>
											<div style={previewSurfaceStyles}>
												<img
													alt={`Variant ${stimulusSet.blindLabel} ${artifact.direction} ${artifact.enlarged.scale}x nearest-neighbor preview`}
													height={artifact.enlarged.height}
													src={artifact.enlarged.artifactPath}
													style={{ display: 'block', imageRendering: artifact.enlarged.imageRendering }}
													width={artifact.enlarged.width}
												/>
											</div>
											<figcaption>
												{artifact.enlarged.scale}
												x nearest-neighbor enlargement
											</figcaption>
										</figure>
									</div>
								</section>
							))}
						</div>
					</article>
				))}
			</section>
			<section aria-label="Phase 0 comparison page scope">
				<h2>Out of scope for this evidence page</h2>
				<p>This remains an intentionally unpolished Phase 0 evidence surface, not the MVP editor.</p>
				<ul>
					{rejectedPhase0Features.map((feature) => (
						<li key={feature}>{phase0ComparisonPageScopeDecision(feature).reason}</li>
					))}
				</ul>
			</section>
		</main>
	)
}
