# Prepare JavaScript source maps

Monocle resolves JavaScript frames through debug IDs injected into each built file and its map. The match does not depend on release versions or deployment declarations. Follow the [source-map guide](https://monocle.sh/docs/sdks/source-maps) for each server and browser output. Analytics-only setups need no maps.

## Vite builds

Use `@monocle.sh/vite-plugin`. With `MONOCLE_API_KEY` in the build environment, it generates hidden maps, injects debug IDs, uploads, and deletes the maps it enabled. Without the key, it generates and uploads nothing: report that gap.

The plugin reads the release like the server agents: `MONOCLE_VERSION`, hosting variables, then CI variables only inside that CI. When the build receives the release under another name, pass it with the plugin's `release` option.

## Compiled Node.js

After the final build, with original sources available, run:

```sh
pnpm exec monocle sourcemaps inject ./build
pnpm exec monocle sourcemaps upload ./build
```

Use the project's package manager and output directory. Do not rebuild after injection: a rebuild changes the debug IDs. Do not upload Vite output a second time through the CLI. The CLI skips files that have no map.

## Keep the token private

Uploads need a private project token and authorization. Keep `MONOCLE_API_KEY` in build secrets only, never in browser code, `VITE_` variables, tracked files, or Docker layers. A Vite build with the token uploads automatically: check authorization before running it.

- With an existing CI workflow, upload after the final build and expose the token to that step only.
- In a Docker build, use a build secret, never a build argument. Pass the commit SHA to the runtime as `MONOCLE_VERSION`, and keep `.map` files out of the image.
- Without a publication workflow, give the build and upload commands in the report and the recap.

Delete `.map` files from anything that is published or served.
