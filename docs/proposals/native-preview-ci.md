# Native preview CI proposal

Status: proposed on 2026-10-26; no workflow has been created or run. Approval is required before adding `.github/workflows/native-preview.yml` or dispatching it. The repository's [AGENTS.md](../../AGENTS.md) requires owner authority for CI changes. This proposal makes that decision concrete without requiring an Expo account.

## Intended result and limits

Use the existing public `alvarovillalbaa/dearweek` repository and standard GitHub-hosted runners to produce:

- An Android APK containing its JavaScript bundle, signed with the Expo template's public debug key. It can be sideloaded on compatible ARM64 devices or x86_64 emulators; it is unsuitable for Play publication.
- An unsigned ARM64 iOS Simulator `.app`, compressed as a tar archive to preserve executable permissions and symlinks. It is a compilation artifact for a compatible Apple Silicon simulator, not an iPhone install, TestFlight build or App Store release.

Neither artifact needs Expo authentication or Apple/Google signing credentials. Expo explicitly supports native builds with the local toolchain without an Expo account. Both EAS cloud builds and `eas build --local` require Expo authentication, so they do not resolve the current account constraint. [Expo native build choices](https://docs.expo.dev/develop/development-builds/introduction/), [EAS local prerequisites](https://docs.expo.dev/build-reference/local-builds/)

The default Android debug variant omits its bundle and needs Metro. This proposal builds `release`: Expo's SDK 58 template uses `export:embed` and deliberately assigns `signingConfigs.debug` to that build type. The workflow checks those assumptions and verifies a bundle exists inside the APK. It never creates or uploads a production signing key. [SDK 58 Android template](https://github.com/expo/expo/blob/sdk-58/templates/expo-template-bare-minimum/android/app/build.gradle), [React Native bundle behavior](https://reactnative.dev/docs/react-native-gradle-plugin#debuggablevariants), [Android debug certificates](https://developer.android.com/studio/publish/app-signing#debug-mode)

An unsigned simulator build still needs launch testing. The draft disables signing explicitly and checks the resulting app is unsigned; it does not claim a successful simulator launch or complete native acceptance. Expo also documents a generic simulator build command, `npx expo run:ios --configuration Release --device generic --output ./build`, which skips development-team setup. The direct Xcode invocation below adds explicit unsigned output and a bounded output directory. [Expo build-only workflow](https://docs.expo.dev/more/expo-cli/#build-only-workflow), [SDK 58 Xcode invocation](https://github.com/expo/expo/blob/sdk-58/packages/%40expo/cli/src/run/ios/XcodeBuild.ts)

## Verified inputs and resource boundaries

Read-only provider metadata confirmed Dearweek is public, unarchived and on `main`, with the connected identity holding admin/push permission. The source pins Expo `58.0.19`, React Native `0.88.0` and React `19.3.0`. There is no native workflow, Expo owner, EAS project ID or registered signing identity in the app config. The shared public project module already supplies the client Supabase configuration; this draft supplies no environment secrets or provider overrides. Email delivery remains unverified.

| Input | Draft selection and evidence |
| --- | --- |
| Linux runner | Standard `ubuntu-24.04`, not a larger runner. Its current image lists JDK 17, Android build tools 37.0.0 and API 37 platforms. [Runner image](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md) |
| macOS runner | Standard ARM64 `macos-26`, with Xcode 26.6 selected explicitly. Its current image includes this Xcode, CocoaPods 1.17.0 and Node 24.21.0. [Runner image](https://github.com/actions/runner-images/blob/main/images/macos/macos-26-arm64-Readme.md) |
| SDK support | Expo 58 requires Xcode 26.4+ and Android compile SDK 37. Expo's SDK 58 Android build image uses JDK 17. [SDK requirements](https://docs.expo.dev/versions/v58.0.0/), [Expo build infrastructure](https://docs.expo.dev/build-reference/infrastructure/) |
| Node/JDK | Node 24.21.0 satisfies this repository's engine constraint. Temurin JDK 17 resolves its current patch; the exact resolved versions are logged. |
| Prebuild template | Official `expo-template-bare-minimum@58.0.26`; its package metadata and npm tarball were read without installing it. [SDK 58 template metadata](https://github.com/expo/expo/blob/sdk-58/templates/expo-template-bare-minimum/package.json) |

Standard GitHub-hosted runner compute is free for public repositories, including the standard Linux and macOS labels above. Larger runners are charged even for public repositories and are excluded. Artifact storage has a shared plan allowance; the connected metadata did not expose current usage or a spending stop. Before a run that uploads artifacts, confirm the owner's remaining included artifact allowance can hold the two capped outputs, or keep upload disabled. Free runner compute alone is not proof that every storage operation costs zero. [GitHub billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions), [standard public runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners#standard-github-hosted-runners-for-public-repositories), [storage limits](https://docs.github.com/en/actions/reference/limits#storage-limits-for-all-github-hosted-runners)

The draft permits one manual run at a time, two jobs of at most 60 minutes and no persistent dependency caches. Artifact uploads default to **off**: a compile-only run leaves hashes and compiler results in job logs but no downloadable preview. Uploads require a separately verified included storage allowance; when enabled they retain outputs for one day, capped at 150 MiB for Android and 200 MiB for the simulator archive. A billing-usage read could not establish the allowance with the connected permission scope; no authentication change or retry was attempted. A cap, timeout, missing SDK or disk-space failure stops the attempt; it does not authorize a paid runner, plan upgrade, retry loop, SDK-license acceptance or local fallback. Standard runner storage is limited, so these unexecuted jobs may need adjustment after their first logs. Recheck current image contents before activation; image labels are mutable despite pinned actions. The latest local Storage Guard failure measured 17.7 GiB available versus 34 GiB required; no local fallback is authorized.

Vercel's existing web build does not supply an iOS toolchain. Vercel Sandbox is a metered Linux VM, not a macOS/Xcode builder; no named Dearweek sandbox was present and the team metadata did not disclose billing/quota. It offers no verified advantage over these GitHub runners for this task. No paid Supabase plan is needed to compile either artifact. [Sandbox runtime](https://vercel.com/docs/sandbox), [Sandbox pricing](https://vercel.com/docs/sandbox/pricing)

## Draft workflow — do not activate before approval

The following is a proposed complete file, not an installed workflow. It checks out only the manually selected `main` commit, performs package installation and generation only inside fresh hosted runners, and never commits generated native directories. `prebuild` can alter generated files and package scripts in that disposable checkout; the locked application dependencies must remain unchanged. [Prebuild behavior](https://docs.expo.dev/workflow/continuous-native-generation/)

All action releases and full commit pins below were verified against their official release pages on 2026-10-26: [checkout 7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1), [setup-node 7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0), [setup-java 6.1.0](https://github.com/actions/setup-java/releases/tag/v6.1.0), [upload-artifact 7.0.2](https://github.com/actions/upload-artifact/releases/tag/v7.0.2). These actions use the Node 24 action runtime on current GitHub-hosted runners. No third-party action, cache service, EAS CLI or secret is used.

```yaml
name: Native preview (manual)

on:
  workflow_dispatch:
    inputs:
      upload_artifacts:
        description: 'Upload previews only after the owner verifies included artifact storage'
        type: boolean
        required: true
        default: false

permissions:
  contents: read

concurrency:
  group: dearweek-native-preview
  cancel-in-progress: false

env:
  CI: '1'
  EXPO_NO_TELEMETRY: '1'
  EXPO_NO_DOTENV: '1'

jobs:
  android:
    if: github.repository == 'alvarovillalbaa/dearweek' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-24.04
    timeout-minutes: 60
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version: '24.21.0'
          package-manager-cache: false
      - uses: actions/setup-java@b843ebf9b913146b38da2eaa7aeddf76074ae1ad # v6.1.0
        with:
          distribution: temurin
          java-version: '17'
      - name: Record toolchain and install locked dependencies
        shell: bash
        run: |
          set -euo pipefail
          node --version
          npm --version
          java -version
          df -h .
          npm ci --no-audit --no-fund
      - name: Generate Android project and check template assumptions
        shell: bash
        run: |
          set -euo pipefail
          npx --no-install expo prebuild --platform android --no-install --template expo-template-bare-minimum@58.0.26
          git diff --exit-code -- package-lock.json
          node <<'NODE'
          const fs = require('node:fs');
          const { execFileSync } = require('node:child_process');
          const before = JSON.parse(execFileSync('git', ['show', 'HEAD:package.json'], {encoding:'utf8'}));
          const after = JSON.parse(fs.readFileSync('package.json', 'utf8'));
          for (const key of ['dependencies', 'devDependencies']) {
            if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) throw new Error('Prebuild changed locked dependencies');
          }
          const gradle = fs.readFileSync('android/app/build.gradle', 'utf8');
          const release = gradle.match(/release\s*\{([\s\S]*?)\n\s*\}/)?.[1];
          if (!release || !/signingConfig\s+signingConfigs\.debug/.test(release)) throw new Error('Expected preview debug signing is absent');
          if (!/bundleCommand\s*=\s*["']export:embed["']/.test(gradle)) throw new Error('Expected Expo embedded bundle command is absent');
          NODE
      - name: Compile standalone preview APK
        working-directory: android
        shell: bash
        run: |
          set -euo pipefail
          ./gradlew :app:assembleRelease --no-daemon --max-workers=2 -PreactNativeArchitectures=arm64-v8a,x86_64
      - name: Check and package APK
        shell: bash
        run: |
          set -euo pipefail
          apk=android/app/build/outputs/apk/release/app-release.apk
          test -s "$apk"
          "$ANDROID_HOME/build-tools/37.0.0/apksigner" verify --verbose --print-certs "$apk"
          python3 - <<'PY'
          from pathlib import Path
          from zipfile import ZipFile
          apk = Path('android/app/build/outputs/apk/release/app-release.apk')
          assert apk.stat().st_size <= 150 * 1024 * 1024, 'APK exceeds upload cap'
          with ZipFile(apk) as archive:
              assert archive.getinfo('assets/index.android.bundle').file_size > 0, 'Missing embedded JS'
              for abi in ('arm64-v8a', 'x86_64'):
                  assert any(name.startswith(f'lib/{abi}/') for name in archive.namelist()), f'Missing {abi}'
          PY
          mkdir -p artifacts
          cp "$apk" artifacts/dearweek-android-preview.apk
          sha256sum artifacts/dearweek-android-preview.apk > artifacts/SHA256SUMS.txt
          git rev-parse HEAD > artifacts/SOURCE_COMMIT.txt
          cat artifacts/SHA256SUMS.txt
          cat artifacts/SOURCE_COMMIT.txt
      - if: inputs.upload_artifacts
        uses: actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7.0.2
        with:
          name: dearweek-android-preview-${{ github.sha }}
          path: artifacts/
          if-no-files-found: error
          retention-days: 1
          compression-level: 0

  ios-simulator:
    if: github.repository == 'alvarovillalbaa/dearweek' && github.ref == 'refs/heads/main'
    runs-on: macos-26
    timeout-minutes: 60
    env:
      DEVELOPER_DIR: /Applications/Xcode_26.6.app/Contents/Developer
      RCT_NO_LAUNCH_PACKAGER: '1'
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version: '24.21.0'
          package-manager-cache: false
      - name: Record toolchain and install locked dependencies
        shell: bash
        run: |
          set -euo pipefail
          xcodebuild -version
          node --version
          npm --version
          pod --version
          df -h .
          npm ci --no-audit --no-fund
      - name: Generate iOS project and install Pods
        shell: bash
        run: |
          set -euo pipefail
          npx --no-install expo prebuild --platform ios --no-install --template expo-template-bare-minimum@58.0.26
          git diff --exit-code -- package-lock.json
          node <<'NODE'
          const fs = require('node:fs');
          const { execFileSync } = require('node:child_process');
          const before = JSON.parse(execFileSync('git', ['show', 'HEAD:package.json'], {encoding:'utf8'}));
          const after = JSON.parse(fs.readFileSync('package.json', 'utf8'));
          for (const key of ['dependencies', 'devDependencies']) {
            if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) throw new Error('Prebuild changed locked dependencies');
          }
          NODE
          pod install --project-directory=ios
          test -d ios/Dearweek.xcworkspace
      - name: Compile unsigned simulator app with bundled JavaScript
        shell: bash
        run: |
          set -euo pipefail
          xcodebuild build -quiet \
            -workspace ios/Dearweek.xcworkspace \
            -scheme Dearweek \
            -configuration Release \
            -sdk iphonesimulator \
            -destination 'generic/platform=iOS Simulator' \
            -derivedDataPath build/ios \
            -jobs 2 \
            ARCHS=arm64 \
            CODE_SIGNING_ALLOWED=NO \
            CODE_SIGNING_REQUIRED=NO \
            CODE_SIGN_IDENTITY= \
            COMPILER_INDEX_STORE_ENABLE=NO
      - name: Check and package simulator app
        shell: bash
        run: |
          set -euo pipefail
          app=build/ios/Build/Products/Release-iphonesimulator/Dearweek.app
          test -s "$app/main.jsbundle"
          test "$(/usr/libexec/PlistBuddy -c 'Print CFBundleIdentifier' "$app/Info.plist")" = com.alvarovillalbaa.dearweek
          test "$(lipo -archs "$app/Dearweek")" = arm64
          if signature_info=$(codesign -d "$app" 2>&1); then
            echo 'Expected unsigned simulator output'
            exit 1
          fi
          [[ "$signature_info" == *'code object is not signed at all'* ]]
          mkdir -p artifacts
          tar -C build/ios/Build/Products/Release-iphonesimulator -czf artifacts/dearweek-ios-simulator-arm64.tar.gz Dearweek.app
          python3 - <<'PY'
          from pathlib import Path
          archive = Path('artifacts/dearweek-ios-simulator-arm64.tar.gz')
          assert archive.stat().st_size <= 200 * 1024 * 1024, 'Simulator archive exceeds upload cap'
          PY
          shasum -a 256 artifacts/dearweek-ios-simulator-arm64.tar.gz > artifacts/SHA256SUMS.txt
          git rev-parse HEAD > artifacts/SOURCE_COMMIT.txt
          cat artifacts/SHA256SUMS.txt
          cat artifacts/SOURCE_COMMIT.txt
      - if: inputs.upload_artifacts
        uses: actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7.0.2
        with:
          name: dearweek-ios-simulator-arm64-${{ github.sha }}
          path: artifacts/
          if-no-files-found: error
          retention-days: 1
          compression-level: 0
```

The draft deliberately has no push/PR/schedule trigger, environment dump, secret lookup, provider deployment, signing-account access, store submission, database fixture or email operation. Uploaded files are limited to the checked binary/archive, checksum and source commit. A tar archive preserves the iOS bundle's permissions; uploading an unarchived `.app` directory would lose executable modes. Artifact downloads require GitHub authentication and expire after one day. [Official artifact action behavior](https://github.com/actions/upload-artifact#permission-loss)

## Approval and first-run acceptance

The smallest owner decision is approval to add this manual workflow and perform one bounded **compile-only** run with `upload_artifacts=false`. It needs no new Expo/Apple/Google account and uses standard public runner compute. If approved, first recheck action pins, Xcode path, Android tools and current source; then add only the reviewed workflow and dispatch against the exact published `main` commit. Native binaries are not delivered by a compile-only run. Confirm included artifact storage before enabling uploads in a later run. No workflow file, run, package installation or build was created by this proposal.

The first run must establish the previously unknown facts: that the pinned template generates the expected project names, the hosted disk/memory budget is sufficient, Pods/Gradle resolve successfully, both binary checks pass, and artifacts download with matching SHA-256 hashes. Until then this is a source-supported implementation proposal, not compilation proof. If unsigned simulator launch later requires an ad-hoc local signature, report that result and review the follow-up; this draft does not silently convert its unsigned artifact or claim launch acceptance.

After compilation, record run/job URLs, source SHA, resolved tool versions, output checksums and failures in `docs/results/`. Actual simulator/device launch, photos, permissions, native Auth deep links and the acceptance list in [native-release.md](../native-release.md) remain separate work. Store account ownership, production signing, enrollment fees, final store declarations and store publication remain unresolved. This Dearweek proposal does not authorize CI changes in Parola or convert the older web projects into native apps.
