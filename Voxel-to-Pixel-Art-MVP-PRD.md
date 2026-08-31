# Voxel-to-Pixel-Art MVP — Product Requirements Document

## Document status

- **Stage:** Validation MVP
- **Primary objective:** Validate whether a voxel source model can produce useful, attractive 2D pixel-art assets from multiple fixed perspectives.
- **Target users:** Solo and small-team 2D game developers who need consistent sprites for rigid objects and environment assets.

## 1. Product summary

The product is a perspective-aware pixel-art authoring tool. A user creates or imports a simple voxel model, previews it from several fixed 2D perspectives, adjusts a small set of pixel-art rendering rules, and exports the resulting sprites.

The voxel model is the source of truth, but the intended output is 2D pixel art—not a conventional low-resolution 3D render.

The MVP is not intended to prove that every kind of pixel art can be generated automatically. It should determine whether this workflow is valuable for a narrow asset category and whether the generated output is good enough to use directly or with minor cleanup.

## 2. Problem statement

Creating the same asset from several perspectives is slow and error-prone. Artists and developers must manually maintain consistent proportions, colors, lighting, and recognizable details across each view.

Existing voxel renderers can generate multiple views from one model, but their output often looks like downscaled 3D rather than intentional pixel art. Common problems include noisy colors, weak silhouettes, unstable pixel clusters, excessive lighting detail, and inconsistent outlines.

The product hypothesis is that a constrained projection and rendering pipeline can preserve the consistency benefits of a 3D voxel source while producing usable 2D pixel-art sprites.

## 3. Validation hypotheses

### Primary hypothesis

For rigid game assets, creators can use one voxel model to generate four consistent perspective sprites that they judge usable with little or no manual cleanup.

### Supporting hypotheses

1. The generated sprites look intentionally pixel-art styled rather than merely like low-resolution voxel renders.
2. A creator can complete a multi-view asset faster than drawing every view independently.
3. Real-time multi-perspective previews make changes easier to reason about than repeatedly rendering views manually.
4. A small set of global rendering controls is sufficient for the first useful workflow.
5. PNG output provides enough value to validate demand before semantic data export or engine integrations are built.

### Riskiest assumptions

- Automatic projection can create readable silhouettes and coherent pixel clusters.
- The approach remains useful without perspective-specific manual corrections.
- Users accept voxel-based geometry as a constraint for the initial supported asset types.
- Generated assets require little enough cleanup to provide a meaningful time advantage.

## 4. Target user and initial use case

### Primary user

A solo or small-team game developer who:

- Is building a pixel-art 2D game.
- Needs assets from four directions or perspectives.
- Has limited art time or struggles with cross-view consistency.
- Is willing to work with simple voxel modeling.
- Values a fast, deterministic workflow over unrestricted artistic control.

### Initial asset category

The MVP focuses on **small rigid props**, such as:

- Chests
- Crates
- Chairs
- Tables
- Lamps
- Simple machines
- Small vehicles

Characters, organic creatures, terrain systems, and complex animation are excluded because they introduce pose readability and temporal-stability problems that would obscure the core validation.

### Core job to be done

> When I need a game prop from multiple directions, I want to create it once and generate consistent pixel-art sprites, so I can spend less time redrawing and correcting each view.

## 5. Product principles

1. **Judge the output, not the technology.** Success depends on the exported sprites being useful.
2. **Constrain aggressively.** Fixed perspectives, palettes, and output sizes reduce both implementation complexity and visual ambiguity.
3. **Immediate feedback.** Every model or rendering change should update all perspective previews quickly.
4. **Deterministic results.** The same model and settings must produce the same pixels.
5. **One source, several views.** The voxel model remains the only editable asset source in the MVP.
6. **Expose only meaningful controls.** Avoid recreating a general 3D rendering interface.

## 6. MVP user experience

### Primary workflow

1. The user starts a new project or opens a sample asset.
2. The user creates a voxel model using basic add, remove, and paint operations.
3. The tool continuously displays four fixed perspective previews.
4. The user selects an indexed palette and adjusts limited rendering settings.
5. The user compares the previews at actual size and at an enlarged nearest-neighbor scale.
6. The user exports four transparent PNG files or one sprite sheet.
7. The product optionally asks the user to rate usability and estimate required cleanup.

### Fixed perspectives

The initial perspective set should be one coherent four-direction configuration, chosen during prototyping:

- North
- East
- South
- West

All views use an orthographic camera, identical scale, and a shared elevation angle. Supporting one strong perspective family is more useful for validation than supporting several configurable camera systems poorly.

## 7. Functional requirements

### 7.1 Voxel source editor

The user must be able to:

- Create a model within a small fixed-volume grid.
- Add and remove individual voxels.
- Paint voxels using colors from the selected indexed palette.
- Rotate, pan, and zoom the editor camera without changing export perspectives.
- Undo and redo editing operations.
- Save and reopen the project locally.
- Load at least three bundled sample projects.

Recommended initial volume limit: **32 × 32 × 32 voxels**.

### 7.2 Pixel-art projection

The renderer must:

- Use orthographic projection.
- Render without antialiasing or texture filtering.
- Align output to an integer pixel grid.
- Use palette-indexed colors only.
- Apply deterministic face visibility and depth ordering.
- Support transparent backgrounds.
- Generate all four views from the same model.
- Avoid isolated semi-transparent or blended pixels.

### 7.3 Rendering controls

The user must be able to adjust:

- Palette
- Output scale or pixels per voxel from a small set of presets
- Lighting direction from a small set of presets
- Lighting mode: flat or quantized
- Number of quantized brightness levels
- Outline mode: none, silhouette, or silhouette plus selected internal edges
- Background color for preview only

Controls must apply to all perspectives. Perspective-specific overrides are outside the MVP.

### 7.4 Multi-perspective preview

The product must show:

- Four previews simultaneously.
- Actual-size output.
- Optional enlarged nearest-neighbor preview.
- Output dimensions for each view.
- Updates after model or rendering changes with no explicit render action.

Target preview latency: **under 200 ms** for models within the supported volume on the reference development machine.

### 7.5 Export

The user must be able to export:

- One transparent PNG per perspective.
- A single sprite sheet containing all four perspectives.
- A small JSON manifest describing view names, frame rectangles, dimensions, and palette.

Example manifest scope:

```json
{
	"image": "wooden-chest.png",
	"frameWidth": 32,
	"frameHeight": 32,
	"views": {
		"north": { "x": 0, "y": 0 },
		"east": { "x": 32, "y": 0 },
		"south": { "x": 64, "y": 0 },
		"west": { "x": 96, "y": 0 }
	}
}
```

Semantic projected buffers and runtime rendering formats are excluded until PNG output value is proven.

### 7.6 Lightweight validation capture

For a test build, the product should allow a participant to record:

- Whether the result is usable directly, usable after minor cleanup, or unusable.
- Estimated cleanup time.
- The weakest generated perspective.
- The main visual problem, selected from silhouette, clusters, lighting, outlines, lost detail, or other.
- Whether they would use the workflow for another asset.

This may be implemented as an external interview form rather than production application functionality.

## 8. Pixel-art rendering rules to prototype

The MVP does not need to solve pixel-art rendering generally. It should test the smallest rule set that can outperform a raw voxel render:

1. Palette-constrained face colors.
2. Quantized directional lighting.
3. Deterministic depth and occlusion.
4. Integer-aligned projection.
5. Silhouette outlines.
6. Suppression of internal edges below a minimum visible length.
7. Removal or merging of isolated one-pixel noise where deterministic rules permit it.

The team should compare this output with a baseline renderer that uses the same camera and palette but omits the pixel-art-specific cleanup rules. This establishes whether the specialized renderer creates measurable value.

## 9. Non-goals

The MVP will not include:

- Character rigging or skeletal animation
- Animated exports
- Arbitrary or perspective cameras
- Perspective-specific voxel visibility
- Manual 2D pixel corrections
- Automatic preservation of manual corrections after model changes
- Semantic per-pixel projected-buffer export
- Game-engine plugins
- Dynamic runtime lighting
- Collaborative or cloud projects
- A marketplace or asset library
- Advanced modeling tools such as sculpting, procedural generation, or Boolean operations
- Import compatibility with every voxel format
- Mobile or tablet support

If modeling work threatens the validation schedule, importing a constrained existing voxel format may replace part of the built-in editor. The renderer and multi-view workflow are the product risk; the modeling interface is supporting infrastructure.

## 10. Success criteria

### Validation cohort

Test with **8–12 target users**. Each participant should create or adapt at least one rigid prop and export four views. Include both people comfortable with pixel art and developers who rely on premade or generated assets.

### Primary success metric

At least **70% of completed assets** are rated by their creator as either:

- Usable directly, or
- Usable after no more than 10 minutes of cleanup across all four views.

### Secondary success metrics

- At least 70% of participants say they would use the workflow for another suitable asset.
- Median time from starting a sample or blank model to a four-view export is 20 minutes or less.
- At least 60% of participants report the workflow is faster than their current method for the same task.
- At least 70% of generated view sets are judged visually consistent across perspectives by an independent pixel artist or designer.
- The specialized renderer is preferred over the baseline voxel render in a blind comparison for at least 70% of evaluated assets.
- At least five participants request a concrete next capability, indicating a real workflow they want to continue rather than only curiosity about the demo.

### Failure indicators

Reconsider or narrow the product if:

- Most outputs need substantial manual redrawing.
- Participants value the 3D consistency but dislike the resulting style.
- The useful asset category is too narrow to support repeated use.
- Users spend more time fighting voxel modeling than they save on multi-view drawing.
- Quality depends on perspective-specific corrections for nearly every asset.

## 11. Validation plan

### Phase 0: Renderer feasibility spike

Before building a complete editor, create five representative prop models and generate four views using both:

- A basic voxel-rendering baseline.
- The proposed pixel-art rule pipeline.

Conduct blind preference tests with at least five target users. Proceed to the interactive MVP only if the specialized output shows a clear preference or exposes a small, actionable set of defects.

### Phase 1: Moderated prototype tests

Observe 5–6 users completing the full workflow. Record:

- Time spent modeling versus adjusting rendering.
- Settings they understand or ignore.
- Perspectives that consistently fail.
- Manual cleanup performed after export.
- Whether the exported asset fits into a small example game scene.

Do not teach participants the interface beyond a short onboarding prompt; unclear workflow is itself evidence.

### Phase 2: Short independent trial

Give the build to another 3–6 users for several days. Ask each person to export at least two assets and provide the original project, final PNGs, any manually corrected PNGs, time estimates, and ratings.

Repeated voluntary use is stronger evidence than positive feedback during a demo.

### Phase 3: Decision

Choose one outcome:

- **Continue:** Core metrics pass; invest in corrections, animation, or semantic export based on observed demand.
- **Narrow:** The workflow works for a particularly strong category such as furniture, buildings, or vehicles; specialize around it.
- **Revise:** Users value multi-view generation but output quality is insufficient; focus on the projection algorithm before product expansion.
- **Stop:** The result is not better or faster enough than existing workflows.

## 12. Required test assets

Use a deliberately varied but bounded evaluation set:

1. A wooden chest with lid, trim, and latch.
2. A chair with thin legs and open negative space.
3. A lamp with a narrow stem and bright top.
4. A small machine with several materials and asymmetrical details.
5. A compact vehicle with a strong directional front.

These cases test bulky forms, thin features, negative space, material separation, asymmetry, and directional readability.

## 13. Technical and quality requirements

- Desktop-first; Linux, macOS, or web support may be selected based on fastest prototyping path.
- Projects and exports work without an account.
- User projects remain local.
- Rendering is deterministic across repeated exports on the same supported build.
- Exported PNGs preserve exact palette colors and transparency.
- The editor remains responsive at the maximum supported model volume.
- Crashes or invalid project data must not silently overwrite the last valid save.

Implementation technology is intentionally unspecified. The fastest stack that supports interactive voxel editing, deterministic raster output, and distributable user testing should be chosen.

## 14. MVP scope priorities

### Must have

- Create or load a simple voxel model
- Assign palette colors
- Four simultaneous fixed-view previews
- Deterministic pixel-grid projection
- Flat or quantized lighting
- Basic outline modes
- PNG and sprite-sheet export
- Local project save/load
- Sample assets

### Should have

- Undo/redo
- Baseline-versus-specialized renderer toggle for research
- JSON sprite manifest
- Actual-size and enlarged preview modes
- Simple feedback capture

### Could have

- Import from one common voxel format
- Screenshot-ready comparison view
- A few preset visual styles

### Will not have

Everything listed in the non-goals section, especially animation, arbitrary perspectives, correction layers, and engine integrations.

## 15. Key product decisions to make during prototyping

1. Which four-direction camera elevation produces the most generally useful results?
2. Should one voxel map to one output pixel, or should a small set of scale presets be supported?
3. Which outline rule most improves readability without making every asset look heavy?
4. Can isolated-pixel cleanup be rule-based without damaging intentional thin features?
5. Is the built-in editor adequate for validation, or is importing models a faster route?
6. Do users prefer controlling light direction or selecting complete rendering presets?

These are prototype questions, not decisions that must be settled before implementation.

## 16. Post-MVP candidates

Only prioritize these after validation evidence:

- Nondestructive perspective-specific 2D corrections
- Visibility and detail overrides by perspective
- Eight-direction output
- Animation and temporal-stability rules
- Semantic projected-surface data
- Palette swapping and material metadata
- Game-engine importers
- More advanced voxel editing

The next feature should be selected from observed user blockage, not from architectural completeness.

## 17. Release decision checklist

The MVP is ready for validation when:

- A participant can create or load a prop without developer assistance.
- All four previews update interactively.
- Five required test assets render without technical failure.
- PNG exports match previews exactly.
- Output can be placed in at least one simple 2D game scene.
- The baseline comparison is available for testing renderer value.
- The research script and feedback rubric are prepared.

The MVP is successful only when user evidence supports the workflow and output—not merely when all software requirements are implemented.
