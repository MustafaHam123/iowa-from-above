# Native companion and QR links

The native SwiftUI project is in `/Users/mustafahameed/Downloads/fromabove`. It uses only Apple frameworks. The website adds one small, lazily loaded dependency, `jsqr`, to support camera/image QR decoding in browsers including Safari. QR generation uses Apple's Core Image at build time; no external QR service is called.

## Connection

The Journey card's **Send to phone** action shows a bundled QR encoding `fromabove://place/<known-id>`. The native camera scanner or the app's QR-photo import can open it. The app generates HTTPS place links and QR images. The website's **Journey → Scan QR** accepts a camera feed, image or pasted place link and opens `/?place=<id>`. All scanned URLs are checked for known IDs and allowed hosts; arbitrary QR URLs are never followed.

`/places/<id>` is the shared mobile landing page with an app link and a 3D preview link. `/.well-known/apple-app-site-association` connects that path to the existing Apple team and bundle ID. Associated Domains works after deployment and Apple verification; custom-scheme links work on installed builds immediately.

A preview is a separate `explore` controller state. It positions the existing drone/camera at the linked place, skips the intro/tutorial for that preview and does not record invented completion or overwrite a saved checkpoint. Resume journey reloads the normal route. Original flight, sky, tile and lighting settings remain intact.

## Regenerate shared content

From the website repository:

```sh
node scripts/exportCompanionPlaces.cjs /Users/mustafahameed/Downloads/fromabove/fromabove/Resources/places.json
swift scripts/generateCompanionQR.swift /Users/mustafahameed/Downloads/fromabove/fromabove/Resources/places.json public/companion
```

The app README documents permissions, native capabilities, data provenance, signing, website address configuration and device-only verification.

## Simpler shared interface

The app uses the website’s charcoal gradient and asymmetric Journey-card corners for its place cards, reader and scan surface. It has two tabs: Explore and Journal. **Scan website** stays visible; search, location, satellite and reminder settings live in **Map tools**. Place cards expose **Web QR** without opening the full reader. Conservation guidance lives under **What helps → More actions**. Longer data and source explanations start collapsed. On the web, the current Journey place has a single **Send to phone** QR; the reader no longer repeats it. Shared place pages show the QR immediately.
