# The Scent Shelf

Pre-launch website for The Scent Shelf, an online perfume store for India. Its job right now is to collect a waitlist.

It is a plain static site: HTML, CSS and JavaScript files, with no build step. What is in this folder is exactly what is served.

## What is where

| File | What it is |
| --- | --- |
| `index.html` | Home page |
| `shop.html` | The full catalogue with search, house, scent family and sort |
| `find.html` | Scent Finder: describe what you want and get a shortlist |
| `privacy.html`, `terms.html`, `refunds.html`, `shipping.html`, `contact.html` | Legal pages (placeholders marked `[TO CONFIRM]`) |
| `data/products.json` | Brands and products. Edit this to add or change products |
| `js/config.js` | Waitlist link, deposit switch, Razorpay link |
| `perfume.html` | One page per perfume (`perfume.html?id=product-id`): accords, notes, performance, when to wear, similar perfumes |
| `js/find.js` | The Scent Finder's matching rules |
| `js/profile.js` | How accords, projection, seasons and similar perfumes are worked out from the data |
| `apps-script/Code.gs` | The script that saves waitlist signups into your Google Sheet |
| `serve.ps1` | Runs the site on your own computer |
## Run it on your computer

Right-click `serve.ps1` and choose **Run with PowerShell**, then open <http://localhost:5173/>. Close the window to stop. Nothing is installed.

(Opening `index.html` by double-clicking will not work; browsers block parts of the site unless it is served.)

On your own computer the waitlist form runs in demo mode: it shows the success screen but saves nothing.

Handy test address:

- `http://localhost:5173/?deposit=preview` shows the deposit offer after a demo signup, so you can read the wording. This only works on your own computer.

## Deploy

The site is hosted on GitHub Pages from the `main` branch of this repository. Any change pushed to `main` goes live in a minute or two at <https://ketchup-69.github.io/thescentshelf/>.

You can edit files directly on github.com (open the file, click the pencil, commit) and the site updates itself.

## Connect the Google Sheet (waitlist)

Until this is done the live form tells visitors the waitlist is not open yet and saves nothing.

1. Create a new Google Sheet in the Google account that should own the data.
2. In the sheet: **Extensions > Apps Script**. Delete whatever is there and paste in everything from `apps-script/Code.gs`. Save.
3. **Deploy > New deployment**. Type: **Web app**. Execute as: **Me**. Who has access: **Anyone**. Click Deploy and approve the permission prompt.
4. Copy the web app URL (it ends in `/exec`).
5. Open `js/config.js` and paste it between the quotes of `WAITLIST_ENDPOINT`. Commit.
6. Join the waitlist on the live site with a test entry. A `Waitlist` tab appears in the sheet with one row per person, and the site shows that person's position.

The same phone or email joining twice keeps its original place and is not added again.

If you change `Code.gs` later, use **Deploy > Manage deployments > Edit > New version** so the URL stays the same.

## Priority deposit (switched off)

The ₹100 deposit offer is built but hidden. It appears after someone joins the waitlist only when **both** of these are set in `js/config.js`:

```js
export const PRIORITY_DEPOSIT_ENABLED = true;
export const RAZORPAY_PAYMENT_LINK = 'https://rzp.io/l/your-link';
```

**Set the Razorpay link:** in the Razorpay dashboard create a Payment Link or Payment Page for ₹100 and paste its URL into `RAZORPAY_PAYMENT_LINK`.

**Switch it on:** change `PRIORITY_DEPOSIT_ENABLED` to `true`. To switch it off again, set it back to `false`.

Leave it off until the business is registered, Razorpay KYC is approved, the `[TO CONFIRM]` items on the legal pages are filled in, and a CA or lawyer has reviewed the refund wording. `DEPOSIT_REFUND_DAYS` (60) must match what `refunds.html` says.

## Add or change products

Open `data/products.json` and add an entry to `products`:

```json
{ "id": "lattafa-new-scent", "brand": "lattafa", "name": "New Scent", "size_ml": 100,
  "concentration": "Eau de Parfum", "for": "U", "planned_price_inr": 2990, "status": "waitlist",
  "family": "sweet", "notes": ["vanilla", "amber", "musk"], "longevity": 4 }
```

- `id` must be unique, lowercase, with dashes.
- `brand` must match a brand `id` in the `brands` list at the top of the file.
- `for` is `M`, `W` or `U` (anyone).
- `planned_price_inr` can be `null`. The card then says "Announced at launch".
- `status` stays `"waitlist"` until the store opens. Every product shows "Coming soon · Join waitlist".
- `family` is one of: fresh, citrus, aquatic, green, floral, fruity, sweet, spicy, woody, amber, musky, leather, oud.
- `longevity` is 1 to 5. `family`, `notes` and `longevity` are what the Scent Finder matches on.

To add a brand, add it to `brands` with a `group` of `Arabic`, `Designer` or `Niche`.

Do not put marketplace prices, supplier prices or internal notes in this file. This repository is public.

### Product photos

Cards are text-only until a product has a photo. To add one, put the image in an `images` folder and add `"image": "./images/your-file.jpg"` to that product. Only use photos you have the right to use (your own, or ones your supplier has given you).

### Where the catalogue came from

Names, sizes and prices were collected on 13 November 2026 from public listings on Indian perfume retailers. Planned launch prices are the lowest listed price minus ₹350. Chanel, Diptyque, Bond No. 9 and a few others had no usable rupee price, so they show "Announced at launch". Scent family, notes and longevity were written from general knowledge and are estimates. All of it should be checked against your supplier's list before launch.
## Custom domain (later)

Not active yet. When `thescentshelf.in` is ready:

```bash
# 1. In the repository: Settings > Pages > Custom domain > thescentshelf.in
#    (this creates a file named CNAME containing: thescentshelf.in)
# 2. At the domain registrar, add these DNS records:
#    A     @    185.199.108.153
#    A     @    185.199.109.153
#    A     @    185.199.110.153
#    A     @    185.199.111.153
#    CNAME www  ketchup-69.github.io
# 3. Back in Settings > Pages, tick "Enforce HTTPS" once it is offered.
# 4. In 404.html, change the two "/thescentshelf/" paths to "/".
```

## Before sharing the link widely

- Fill in every `[TO CONFIRM]` on the five legal pages (business name, address, contact email, grievance officer, retention period). The privacy notice needs a working email address before real signups are collected.
- Connect the Google Sheet.
- Check the catalogue against your supplier's list: names, sizes, prices, notes and longevity.
- Only list brands you can actually supply. A waitlist for a product you cannot source is a promise you cannot keep.
- Have a CA or lawyer review the legal pages before any money is collected.

## Rules the site follows

- No fake scarcity: no stock counts, countdowns or "people viewing" numbers.
- Prices are labelled "Planned launch price". No comparisons with other shops.
- The waitlist collects only name, phone or email, city and chosen perfumes, behind an unticked consent box.

## Technical notes

- No JavaScript libraries. Typefaces load from Google Fonts.
- The Scent Finder runs entirely in the visitor's browser. Nothing typed into it is sent anywhere.
- The header and footer are repeated in each HTML file. If you change a footer link, change it in all nine pages.
