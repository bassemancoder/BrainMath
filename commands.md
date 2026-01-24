# BrainMath Android Commands

## Environment Setup

Add these to your `~/.bashrc` for convenience:

```bash
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin
```

## Emulator Commands

### List available emulators
```bash
$ANDROID_HOME/emulator/emulator -list-avds
```

### Start emulator
```bash
$ANDROID_HOME/emulator/emulator -avd Medium_Phone_API_36.1
```

### Start emulator without audio (fixes libpulse issues)
```bash
$ANDROID_HOME/emulator/emulator -avd Medium_Phone_API_36.1 -no-audio
```

### Start emulator in background
```bash
$ANDROID_HOME/emulator/emulator -avd Medium_Phone_API_36.1 &
```

## ADB Commands

### Check connected devices
```bash
adb devices
```

### Restart ADB server (if device shows offline)
```bash
adb kill-server && adb start-server
```

### Install APK
```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### Launch app
```bash
adb shell am start -n com.brainmath.app/.MainActivity
```

### Uninstall app
```bash
adb uninstall com.brainmath.app
```

### View app logs
```bash
adb logcat | grep -i brainmath
```

## Build Commands

### Build web assets
```bash
npm run build
```

### Sync web assets to Android
```bash
npx cap sync android
```

### Build debug APK
```bash
cd android && ./gradlew assembleDebug
```

### Build release AAB (for Play Store)
```bash
cd android && ./gradlew bundleRelease
```

### Full build + sync + open Android Studio
```bash
npm run android
```

### Full build + sync only
```bash
npm run android:sync
```

## One-liner: Build and Install

```bash
npm run build && npx cap sync android && cd android && ./gradlew assembleDebug && cd .. && adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

## One-liner: Build, Install and Launch

```bash
npm run build && npx cap sync android && cd android && ./gradlew assembleDebug && cd .. && adb install -r android/app/build/outputs/apk/debug/app-debug.apk && adb shell am start -n com.brainmath.app/.MainActivity
```

## Icon Generation

### Regenerate app icons from logo (requires ImageMagick)
```bash
convert public/logo-512.png -resize 48x48 android/app/src/main/res/mipmap-mdpi/ic_launcher.png
convert public/logo-512.png -resize 72x72 android/app/src/main/res/mipmap-hdpi/ic_launcher.png
convert public/logo-512.png -resize 96x96 android/app/src/main/res/mipmap-xhdpi/ic_launcher.png
convert public/logo-512.png -resize 144x144 android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png
convert public/logo-512.png -resize 192x192 android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png
```

## Output Locations

| Build Type | Output Path |
|------------|-------------|
| Debug APK | `android/app/build/outputs/apk/debug/app-debug.apk` |
| Release APK | `android/app/build/outputs/apk/release/app-release.apk` |
| Release AAB | `android/app/build/outputs/bundle/release/app-release.aab` |

## Troubleshooting

### Emulator shows "offline"
```bash
adb kill-server && adb start-server
```

### KVM permissions error
```bash
sudo gpasswd -a $USER kvm
# Then log out and back in
```

### libpulse.so error
```bash
sudo apt install -y libpulse0
# Or run emulator with -no-audio flag
```
