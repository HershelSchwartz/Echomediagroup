# EchoRide phone apps

There are two native apps, each with an Android project and an iOS project. They are built with [Capacitor](https://capacitorjs.com) from the same code as the web apps in `../public`.

| App | Folder | App ID | Icon |
| --- | --- | --- | --- |
| EchoRide (riders) | `rider/` | `com.echomediagroup.echoride` | White pin on teal |
| EchoRide Driver | `driver/` | `com.echomediagroup.echoride.driver` | Teal pin on dark |

Change the app IDs in `../scripts/build-mobile.js` before your first store upload. The stores don't let you change them afterwards.

## Get the APKs (Android, no tools needed)

GitHub builds both Android apps automatically on every push that changes `ride-app/`.

1. Open the repository on GitHub and go to **Actions**, then **Android APKs**.
2. Open the latest run with a green check mark.
3. Under **Artifacts**, download `EchoRide-rider-apk` and/or `EchoRide-driver-apk`. Each is a zip containing the `.apk`.
4. Copy the `.apk` to your Android phone and open it. Allow "Install unknown apps" if asked.

On first launch the app asks for a **Server address**. Enter where your EchoRide server is running:

- **Testing at home:** run `npm start` in `ride-app` on your computer, then enter `http://<your-computer's-IP>:3000`. Your phone must be on the same Wi-Fi.
- **Hosted server:** enter its `https://` address.

To build APKs with a server address built in, open **Actions → Android APKs → Run workflow** and fill in `server_url`. Or set the repository variable `ECHORIDE_SERVER_URL`.

These are debug builds for testing. Store releases need a signed build, described below.

## What you need

- **Android:** [Android Studio](https://developer.android.com/studio). It installs the Android SDK on first launch.
- **iPhone:** a Mac with Xcode 16 or newer, plus an Apple Developer account for real devices and the App Store.
- Node.js 20 or newer.

## Try it on your phone (same Wi-Fi as your computer)

1. Start the server on your computer:
   ```bash
   cd ride-app && npm install && npm start
   ```
2. Find your computer's local IP address, for example `192.168.1.20`.
3. Build the apps to point at it:
   ```bash
   SERVER_URL=http://192.168.1.20:3000 npm run mobile:build
   ```
4. Install, sync and open the app you want:
   ```bash
   cd mobile/driver        # or mobile/rider
   npm install
   npx cap sync
   npx cap open android    # or: npx cap open ios
   ```
5. Press **Run** in Android Studio or Xcode with your phone plugged in.

Install the rider app on one phone and the driver app on another (or use the web driver page) to run a full trip.

Leave out `SERVER_URL` to have the app ask for the address on its sign-up screen instead.

Plain `http://` only works for local testing. The build script switches on the settings it needs and warns you.

## Release builds for the stores

1. Deploy the server somewhere with an `https://` address, such as Render, Fly.io or Railway.
2. Rebuild with that address:
   ```bash
   SERVER_URL=https://api.yourdomain.com npm run mobile:build
   ```
   With https, the http-only testing settings are left out.
3. Run `npx cap sync` in each app folder.
4. Build and upload:
   - **Android:** Android Studio → Build → Generate Signed App Bundle, then upload the `.aab` to Google Play Console.
   - **iOS:** Xcode → Product → Archive, then upload to App Store Connect.

The server allows the phone apps' built-in origins (`capacitor://localhost` for iOS, `https://localhost` for Android) by default. Override them with `CORS_ORIGINS` (comma-separated) if needed.

## Whenever you change the web code

Re-run `npm run mobile:build`, then `npx cap sync` in the app folder. The native projects copy the web code at sync time.

## Known gaps

- **Background location for drivers:** the driver's position only updates while the app is open on screen. Live tracking with the phone locked needs a background-location plugin, such as `@capacitor-community/background-geolocation`. It also needs the "Always" location permission, which both stores review closely.
- **Push notifications:** ride offers arrive over the live connection, so a driver only sees them with the app open. Add Firebase Cloud Messaging / APNs (`@capacitor/push-notifications`) so offers reach a locked phone.
- **Map tiles:** the free OpenStreetMap tile server isn't allowed for production app traffic. Switch the tile URL in `public/common.js` to a paid provider such as MapTiler or Stadia Maps.
