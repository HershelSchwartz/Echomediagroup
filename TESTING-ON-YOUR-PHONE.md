# Test Plainfare on your phone

About 15 minutes, free, no credit card. You get a private web link that works on any phone, and
(optionally) an Android APK made from that link.

## 1. A free database (Neon)

1. Sign up at neon.tech (free plan).
2. Create a project (any name, region near you).
3. On the project dashboard, copy the **connection string** (it starts with `postgresql://`).

## 2. A free host (Vercel)

1. Sign up at vercel.com with your GitHub account.
2. **Add New → Project** → import `hershelschwartz/echomediagroup`.
3. The app is on the branch `ccr-d97ac6ec-y7snfl`. Either merge it into `main` on GitHub first, or after
   the import set **Settings → Git → Production Branch** to `ccr-d97ac6ec-y7snfl` and redeploy.
4. Before deploying, open **Environment Variables** and add:

   | name | value |
   | --- | --- |
   | `DATABASE_URL` | the Neon connection string |
   | `DEMO_MODE` | `1` |
   | `CRON_SECRET` | any long random text |

5. Deploy. The build sets up the database and adds the demo data by itself (`vercel-build` script).
6. Copy your link, like `https://echomediagroup.vercel.app`. Add it as `APP_URL` in the environment
   variables and redeploy once, so share links point to it.

## 3. Try it

Open the link on your phone. A yellow bar says it's a test version. Sign-in codes appear on screen
(no texts are sent), and payments use test cards (no money moves).

| who | phone number to sign in with |
| --- | --- |
| rider | `+15550000100` (or any number; you'll be asked your name) |
| driver | `+15550000201` (use a second phone, or a private/incognito window) |
| operations console (`/admin`) | `+15550000001` |

For the ride itself: open `/drive` as the driver and tap **Go**, leave **Simulate driving** on, then
request a ride as the rider. The driver gets the request, and the car moves on its own.

On your phone's browser menu, choose **Add to Home Screen** to get an app icon.

## 4. Optional: an Android APK

1. Go to pwabuilder.com and paste your link.
2. Choose **Package for stores → Android → Generate**, then download the zip.
3. Copy the test APK from the zip to your Android phone and open it (allow installs from this source when asked).

The APK opens your link in an app window, so it needs the deployed site from step 2.

## Before anything real

Demo mode lets **anyone with the link sign in as any number, including the admin**. Keep the link
private, and delete the Vercel project (or remove `DEMO_MODE`) when you finish testing. A real launch
uses `replica/deploy.md` instead: Twilio for texts, Stripe for cards, your own domain, and no `DEMO_MODE`.
