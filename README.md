# M.O.B TaskManager

A focused full-stack productivity app built with Angular and FastAPI, with web/PWA and Tauri desktop/mobile packaging.

## What is in the app

- JWT registration and login
- User profiles and account security
- Task CRUD with priorities, status, due dates, tags, estimates, and time spent
- Habit tracking with daily check-ins
- Meditation challenges
- Reading challenges
- Real task analytics
- AI assistant for tasks, habits, reading, and meditation
- Brevo transactional email for registration, account-security notifications, and contact messages
- Installable PWA web app
- Native packaging for macOS, Windows, Android and iOS
- Public Downloads page with platform-aware install options and QR-code support

## Stack

- Angular 22.0.8
- Node.js 22.22.3
- TypeScript 6.0.3 (Angular 22.0.x requires TypeScript 6.0.x)
- Tauri 2
- Rust stable
- Python 3.14.7
- FastAPI
- SQLAlchemy
- SQLite by default
- Groq for the AI assistant
- Brevo SMTP for transactional email

## Local setup

### Backend

Python 3.14.7 is the validated backend runtime and is pinned in `backend/.python-version`.

```bash
cd backend
python -m venv .venv
# Windows PowerShell: .\.venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
# Copy backend/.env.example to backend/.env if you have not already created it.
python -m uvicorn app.main:app --reload --port 8000
```

Verify the active runtime with:

```bash
python --version
```

Expected: `Python 3.14.7`.

Set the real credentials only in `backend/.env` (or your deployment provider's secret/environment settings). Never commit API keys or SMTP keys.

Required production values:

- `SECRET_KEY`
- `GROQ_API_KEY`
- `BREVO_SMTP_LOGIN`
- `BREVO_SMTP_KEY`
- `SENDER_EMAIL`

The sender email must be verified in Brevo.

### Frontend web app

```bash
cd frontend
npm install
npm start
```

The Angular development proxy forwards `/api` and `/auth` calls to FastAPI on port 8000.

Production Angular builds also include a web manifest and service worker, so the Render-hosted web version can be installed as a PWA from supported browsers.

## Downloads page and QR codes

The public `/downloads` route exposes install options for:

- Web/PWA
- macOS Universal (Intel + Apple Silicon)
- Windows x64
- Windows ARM64
- Android
- iPhone/iPad

Native download URLs are runtime-configured in `frontend/public/downloads.json`. A native button and its QR code remain disabled until both `available` is `true` and a real URL is provided. This prevents the site from advertising placeholder installers before signed packages are published.

The Web/PWA QR code is generated from the active HTTP(S) site URL. Native QR codes are generated from the same verified URL used by each platform download button.

Example after a real package has been published:

```json
{
  "macos": {
    "available": true,
    "url": "https://example.com/releases/MOB-TaskManager.dmg"
  }
}
```

Do not enable a native target until the referenced artifact is genuinely downloadable and appropriate signing requirements have been completed.

## Native desktop and mobile apps

The native shells use the same Angular frontend. Native builds require the public backend URL because an installed app cannot use the browser development proxy.

Set it before packaging:

### macOS/Linux

```bash
export APP_API_BASE_URL="https://your-api.onrender.com"
```

### Windows PowerShell

```powershell
$env:APP_API_BASE_URL="https://your-api.onrender.com"
```

`APP_API_BASE_URL` is a public endpoint, not a secret. Groq, Brevo and JWT signing credentials must never be placed in the frontend/native build.

### macOS — Intel and Apple Silicon

The configured macOS target is universal, so one build supports Intel Macs (including a 2019 Intel MacBook Pro) and Apple Silicon Macs.

Install Xcode Command Line Tools and Rust, then:

```bash
cd frontend
npm install
rustup target add x86_64-apple-darwin aarch64-apple-darwin
npm run desktop:build:mac
```

Output is under:

```text
frontend/src-tauri/target/universal-apple-darwin/release/bundle/
```

For public direct-download distribution without Gatekeeper warnings, the macOS app must later be signed and notarized with Apple credentials.

### Windows x64

Install Rust with the MSVC toolchain and Microsoft C++ Build Tools, then:

```powershell
cd frontend
npm install
rustup target add x86_64-pc-windows-msvc
npx tauri build --target x86_64-pc-windows-msvc --bundles nsis,msi
```

### Windows ARM64

Tauri supports native ARM64 Windows binaries through `aarch64-pc-windows-msvc`. The Microsoft ARM64 C++ build tools must be installed in addition to the Rust target:

```powershell
rustup target add aarch64-pc-windows-msvc
npx tauri build --target aarch64-pc-windows-msvc --bundles nsis
```

Production Windows distribution should later add code signing to reduce SmartScreen warnings.

### Android

Install Android Studio/SDK/NDK and Rust's Android targets, then initialize once:

```bash
cd frontend
npm install
npm run mobile:android:init
```

For local testing:

```bash
npm run mobile:android:dev
```

Release APK/AAB commands are available as:

```bash
npm run mobile:android:apk
npm run mobile:android:aab
```

A persistent Android signing keystore is required before distributing release APK/AAB files or publishing to Google Play.

### iPhone / iPad

A Mac with the full Xcode installation is required. On an Intel 2019 MacBook, install Xcode, Homebrew, CocoaPods and the iOS Rust targets:

```bash
brew install cocoapods
rustup target add aarch64-apple-ios x86_64-apple-ios aarch64-apple-ios-sim
cd frontend
npm install
npm run mobile:ios:init
npm run mobile:ios:dev
```

The generated Xcode project is under `frontend/src-tauri/gen/apple`. Open it in Xcode to select an Apple Team and run the app on a connected iPhone.

A physical-device `.ipa` must be signed with an Apple development/distribution certificate and provisioning profile. The repository does not contain or fake those credentials.

## Platform validation

The regular CI validates Python 3.14.7, Angular 22, the PWA build, unit tests, the 320px-to-3440px browser responsiveness matrix, native Angular routing and the Rust/Tauri shell.

`.github/workflows/native-platform-smoke.yml` adds representative platform checks:

- Windows x64: build NSIS package, silent-install it and launch the installed app
- Windows ARM64: compile the ARM64 target and verify the generated executable architecture
- macOS: create and mount the Universal DMG, then verify the app binary contains both `x86_64` and `arm64` slices
- Android: build an APK, install it in an Android emulator and launch it
- iOS: build for iOS Simulator, install the `.app` in a simulator and launch it

These checks are stronger than compile-only validation, but they are not a claim that every physical device model, OS patch version or hardware configuration in existence has been tested. Before public release, perform final manual tests on representative real hardware, especially a signed physical iPhone/iPad build and the intended Mac/Windows devices.

## Packaging workflow

`.github/workflows/package-native.yml` is a manual workflow. It asks for `api_base_url` and can create GitHub Actions artifacts for:

- Windows x64 installers
- Windows ARM64 installer
- Universal macOS Intel + Apple Silicon DMG/app
- Android test APK
- iOS Simulator app

The iOS Simulator artifact is not a physical-iPhone IPA. Physical iPhone distribution is enabled after Apple signing/provisioning is configured.

## Render deployment note

Deployment is intentionally not configured or triggered yet.

When deploying later:

- backend secrets stay in Render environment variables
- add the deployed web origin plus `tauri://localhost` and `http://tauri.localhost` to `CORS_ORIGINS`
- set `APP_URL` to the deployed web URL for email links
- package native apps with `APP_API_BASE_URL` set to the public Render backend URL
- populate `frontend/public/downloads.json` only after real signed packages are published

If frontend and backend are separate Render services, the web build must either use a public API base URL or a Render proxy/rewrite. Do not put backend secrets in Angular environment files.

## Email

All transactional email goes through Brevo SMTP (`smtp-relay.brevo.com`, port `587`). The app uses the SMTP key for relay authentication; the Brevo API key is not required for this integration.

## Security

Secrets are backend-only. The web frontend and native apps never receive the Groq key, Brevo SMTP key, or JWT signing secret.
