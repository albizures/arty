import type { CSSProperties } from 'react'

import type { ComparisonInspectionBackground } from '../domain/comparison-page-preview'

import { useState } from 'react'
import { OFFICIAL_BLIND_EVALUATION_PROTOCOL } from '../domain/blind-evaluation-protocol'
import { fixedPhase0ComparisonTrial, PHASE_0_COMPARISON_ARTIFACT_MANIFEST } from '../domain/comparison-artifact-manifest'
import {
	COMPARISON_INSPECTION_BACKGROUND_OPTIONS,

	comparisonInspectionBackgroundStyle,
	comparisonPageTrialPreview,
	phase0ComparisonPageScopeDecision,
} from '../domain/comparison-page-preview'

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

// Stryker disable next-line ObjectLiteral,StringLiteral: response label spacing is visual-only page styling.
const responseCheckboxLabelStyles = { display: 'block', margin: '12px 0' } satisfies CSSProperties
// Stryker disable next-line ObjectLiteral,StringLiteral: cleanup notes label spacing is visual-only page styling.
const cleanupNotesLabelStyles = { display: 'block', marginTop: '12px' } satisfies CSSProperties
// Stryker disable next-line ObjectLiteral,StringLiteral: textarea sizing is visual-only page styling.
const cleanupNotesTextareaStyles = { display: 'block', width: '100%' } satisfies CSSProperties

const rejectedPhase0Features = [
	'voxel-editing',
	'renderer-controls',
	'manual-2d-correction-tools',
	'account-session-systems',
	'product-grade-navigation',
	'generalized-asset-browsing',
] as const

const blindLabels = ['A', 'B', 'C'] as const

function DefectChecklist(props: { legend: string, namePrefix: string }) {
	return (
		<fieldset>
			<legend>{props.legend}</legend>
			{OFFICIAL_BLIND_EVALUATION_PROTOCOL.defectTaxonomy.map((defect) => (
				/* Stryker disable next-line StringLiteral,ObjectLiteral: checklist label block layout is visual-only page styling. */
				<label key={defect} style={{ display: 'block' }}>
					<input name={props.namePrefix} type="checkbox" value={defect} />
					{` ${defect}`}
				</label>
			))}
		</fieldset>
	)
}

export default function Home() {
	const [inspectionBackground, setInspectionBackground] = useState<ComparisonInspectionBackground>('checkerboard')
	const trial = comparisonPageTrialPreview(fixedPhase0ComparisonTrial(), {
		artifactBasePath: PHASE_0_COMPARISON_ARTIFACT_MANIFEST.artifactBasePath,
	})
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
			<section aria-label={`Blind comparison response ${trial.trialId}`}>
				<h2>Trial response</h2>
				<fieldset>
					<legend>Rank A/B/C by most usable as pixel-art game prop sprites</legend>
					{[1, 2, 3].map((rank) => (
						/* Stryker disable next-line StringLiteral,ObjectLiteral: ranking label spacing is visual-only page styling. */
						<label key={rank} style={{ display: 'block', marginBottom: '8px' }}>
							{`Rank ${rank}: `}
							<select name={`rank-${trial.trialId}-${rank}`} required>
								<option value="">Choose A/B/C</option>
								{blindLabels.map((label) => (
									<option key={label} value={label}>{`Variant ${label}`}</option>
								))}
							</select>
						</label>
					))}
				</fieldset>
				<label style={responseCheckboxLabelStyles}>
					<input name={`none-usable-${trial.trialId}`} type="checkbox" />
					{' No option is usable'}
				</label>
				<DefectChecklist legend="Observed defects for the whole trial" namePrefix={`defects-${trial.trialId}-trial`} />
				{blindLabels.map((label) => (
					<DefectChecklist key={label} legend={`Observed defects for variant ${label}`} namePrefix={`defects-${trial.trialId}-${label}`} />
				))}
				<label style={cleanupNotesLabelStyles}>
					Short cleanup notes
					<textarea maxLength={500} name={`cleanup-notes-${trial.trialId}`} rows={3} style={cleanupNotesTextareaStyles} />
				</label>
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
