# Shop Gallery — Setup

This adds a "What's Available At Our Shop" section to your homepage (right
after Products) showing real photos of your shop/shelves. Tap a photo to
view it bigger. If there are no photos yet, it just shows "Shop photos
coming soon" instead of breaking.

## Files added
- `index.html` — updated with the new section + lightbox
- `shop-photos.json` — the list of photos to show. **Starts empty (`[]`)**
  since I don't have your real photos — you fill this in.
- `shop-photos/` — folder where the actual photo files go (create this)

## One-time setup

1. **Create the folder** in the same place as `index.html`:
   ```
   mkdir -p $HOME/shahpesticides/shop-photos
   ```
   (adjust the path to wherever your repo actually lives)

2. **Add `shop-photos.json`** (already created for you, starts as `[]`) in
   the same folder as `index.html` — not inside `shop-photos/`.

## Adding photos (do this any time your stock/shelves change)

1. Take photos on your phone. Landscape or square both work — they'll be
   cropped to a 4:3 box, so avoid anything important right at the edges.

2. **Compress them before uploading** — phone photos are often 3–8MB each,
   which is slow on mobile data. Run them through
   [squoosh.app](https://squoosh.app) or [tinypng.com](https://tinypng.com)
   first — aim for under 300–400KB per photo. This step matters: skipping
   it is the single most common reason a page like this feels slow to load.

3. Rename them something simple — no spaces, lowercase, e.g.
   `fungicide-shelf.jpg`, `insecticide-rack.jpg`, `shop-front.jpg`.

4. Drop the files into `shop-photos/`.

5. Open `shop-photos.json` and add one entry per photo:
   ```json
   [
     { "file": "shop-front.jpg", "caption": "Shah Pesticides, Tral" },
     { "file": "fungicide-shelf.jpg", "caption": "Fungicides in stock" },
     { "file": "insecticide-rack.jpg", "caption": "Insecticide rack" }
   ]
   ```
   - `file` must exactly match the filename in `shop-photos/` (case-sensitive).
   - `caption` is optional — leave it out or set to `""` for no caption.
   - Order in the file = order shown on the site.

6. Push `index.html`, `shop-photos.json`, and the `shop-photos/` folder
   together. No other file needs to change — you'll never have to touch
   `index.html` again just to add or remove a photo.

## Removing a photo
Delete its entry from `shop-photos.json` (the image file can stay in the
folder unused, or delete it too). Push.

## Notes
- If a filename in `shop-photos.json` doesn't match an actual file, that
  one photo card just quietly disappears instead of showing a broken image.
- There's no limit on how many photos you add, but for page speed, a
  couple dozen good ones beats a hundred quick snaps.
