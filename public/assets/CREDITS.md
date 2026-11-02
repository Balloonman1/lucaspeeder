# Asset inventory

All assets below are CC0 (public domain). Sources are the original publishers; files were mirrored from the
`moritzbrantner/asset-tooling` and `pmndrs/drei-assets` GitHub repositories because this build environment can only
reach GitHub and npm.

## Textures (Poly Haven, CC0) — public/assets/textures/{1k,2k}
| Set | Files | Resolution | Used for |
|---|---|---|---|
| rocky_trail | diff, nor_gl, arm, disp | 1K + 2K | dirt trails (terrain splat layer 0) |
| forrest_ground_01 | diff, nor_gl, arm, disp | 1K + 2K | grassy valley floor (layer 1) |
| rocks_ground_02 | col, nor_gl, arm, height | 1K + 2K | stony patches (layer 2), boulders (triplanar) |
| rock_face_03 | diff, nor_gl, arm, disp | 1K + 2K | canyon walls, hoodoos, pylons (triplanar) |
| sand_01 | diff, nor_gl, arm, disp | 1K + 2K | loaded, reserved for sand flats |
| rock_boulder_dry | diff, rough, disp | 1K + 2K | boulders (triplanar) |
Source: https://polyhaven.com/textures — License CC0.

## Models (Quaternius, Stylized Nature MegaKit, CC0) — public/assets/models
| File | Triangles (approx.) | Used for |
|---|---|---|
| Rock_Medium_1/2/3.gltf.json | ~300 each | obstacle boulders (re-skinned with Poly Haven stone via triplanar material) |
| Grass_Common_Short.gltf.json | ~60 | instanced grass clumps |
| Bush_Common_Flowers.gltf.json | ~400 | instanced flowering bushes |
| CommonTree_1.gltf.json, Pine_1.gltf.json | ~1.5k | instanced trees |
Source: https://quaternius.com — License CC0.

## HDRI (Poly Haven, CC0) — public/assets/hdri
kiara_1_dawn_1k.hdr (image-based lighting / reflections) with a tone-mapped .jpg fallback for hosts that do not serve .hdr. Model buffers are embedded in the .gltf.json files for the same reason.

## Still procedural (no suitable free asset reachable from this environment)
- Hover bike and rider (built from primitives with PBR materials). Replace with a GLB when one is available.
- Food items, tomatoes, cherries, energy drink.
- Canyon wall masses and mesas are displaced geometry wrapped in the Poly Haven rock_face_03 texture.
