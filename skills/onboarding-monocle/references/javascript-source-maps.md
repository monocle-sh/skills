# Upload JavaScript source maps

Monocle resolves JavaScript frames through debug IDs injected into each built file and its map. The match does not depend on release versions or deployment declarations. Follow the [source-map guide](https://monocle.sh/docs/sdks/source-maps) for each server and browser output. Analytics-only and uptime-only setups need no maps.

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

## Upload from CI

Uploads use a private project token in `MONOCLE_API_KEY`. Never create the token, and never ask the user to paste it: the team creates it in Monocle and stores it in the CI secrets. Keep it out of browser code, `VITE_` variables, tracked files, and Docker layers.

- With an existing CI workflow, add the upload after the final build. Read `MONOCLE_API_KEY` from the CI secrets in the steps that upload only. The Vite plugin uploads during the build, so the build step needs it too.
- In a Docker build, use a build secret, never a build argument. Pass the commit SHA to the runtime as `MONOCLE_VERSION`, and keep `.map` files out of the image.
- Without a CI workflow, do not create one. Give the build and upload commands, and the secret to set, in the report and the recap.

Delete `.map` files from anything that is published or served.
