# Generating Low-Quality GLB Variants

This folder contains a helper PowerShell script `generate_low_quality_commands.ps1`
that prints recommended `gltf-transform` commands to produce lower-quality
variants of your `.glb` models (e.g. `model.low.glb`).

Why: Your deployed app will prefer `.low.glb` automatically when `window.lowQualityMode`
is enabled. Creating `.low.glb` files (Draco-compressed + reduced textures/quantization)
greatly reduces download and parse time on slow clients.

Recommended workflow

1. Install Node.js (v16+).
2. From the repo root, run:

```powershell
# Print commands (dry-run)
.\scripts\generate_low_quality_commands.ps1

# To run the conversions (will execute npx for each file):
.\scripts\generate_low_quality_commands.ps1 -Run
```

3. The script prints `npx @gltf-transform/cli draco "in.glb" "out.low.glb" ...` commands.
   Allow npx to install `@gltf-transform/cli` when prompted, or pre-install it:

```powershell
npm install -g @gltf-transform/cli
```

4. Verify `.low.glb` files in `frontend/Models/...` and commit + deploy them to your static host.

Notes & tuning
- The script uses reasonable default quantization values. You can reduce file size further
  by lowering quantization (e.g. `--quantizePosition=12`) or resizing textures first.
- Advanced: use `@gltf-transform/functions` (`resize`, `texture-compress`, `simplify`) to
  create even smaller variants; see gltf-transform docs.
