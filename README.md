# TizenPrime

TizenPrime is a TizenBrew site modification module for Prime Video. It injects a small cleanup script into `https://www.primevideo.com/` that blocks common ad/measurement endpoints, hides obvious ad surfaces, and clicks safe skip/continue prompts when they appear.

## Install

1. Open TizenBrew on the TV.
2. Add this folder as a local/GitHub module, or publish/install it as the npm package name `tizenprime`.
3. Launch `TizenPrime` from the TizenBrew modules list.

## Notes

- This is a best-effort module. Prime Video can change its player and ad delivery at any time.
- The script avoids known DRM, license, token, and device-auth URLs so normal playback is less likely to break.
- To debug from the web console, set `window.TizenPrimeDebug = true` and inspect `window.TizenPrime.status()`.

## Package Shape

TizenBrew reads the module metadata from `package.json`:

- `packageType`: `mods`
- `appName`: `TizenPrime`
- `websiteURL`: `https://www.primevideo.com/`
- `main`: `src/tizenprime.js`
