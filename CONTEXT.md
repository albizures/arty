# Arty

Arty is a browser-based creative demo space. Its current domain language centers on a small voxel editor.

## Language

**Cell**:
An addressable slot in the fixed voxel grid. A cell may be empty or contain one voxel.
_Avoid_: Slot, block position

**Voxel**:
An occupied colored cube in a cell.
_Avoid_: Block, cube

**Palette ID**:
A stable identifier for one of the editor's selectable colors. A palette ID is stored on a voxel; rendering maps it to a display color.
_Avoid_: Hex color, material
