# TizenPrime

TizenPrime is a remote-first TizenBrew app shell for Prime Video.

## Install

1. Open TizenBrew on the TV.
2. Add this folder as a local/GitHub module, or publish/install it as the npm package name `tizenprime`.
3. Launch `TizenPrime` from the TizenBrew modules list.

## Notes

- This is a TizenBrew web app, not Amazon's native Samsung Prime Video app.
- Prime Video playback may still fail if Amazon requires a certified TV app, DRM path, or device-specific player.
- The native-app button tries to find and launch the installed Samsung Prime Video app, but it cannot remove ads inside Amazon's native app.
- The app shell is remote-first and opens Prime Video pages from large TV-friendly controls.

## Package Shape

TizenBrew reads the module metadata from `package.json`:

- `packageType`: `app`
- `appName`: `TizenPrime`
- `appPath`: `app/index.html`
