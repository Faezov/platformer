# Snap Notes

The primary Snap configuration lives in `package.json` under the `build.snap` key because this project uses Electron Builder.

Build the Snap with:

```bash
npm run dist:snap
```

If a later release needs hand-tuned Snapcraft staging, generate the Electron Builder output first, inspect `dist/builder-effective-config.yaml`, then promote the proven settings into a `snap/snapcraft.yaml`.
