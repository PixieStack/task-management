#!/usr/bin/env bash
set -euo pipefail

adb wait-for-device

boot_completed=""
for attempt in $(seq 1 30); do
  boot_completed="$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"
  if [[ "$boot_completed" == "1" ]]; then
    break
  fi
  sleep 5
done
test "$boot_completed" = "1"

installed=false
for attempt in 1 2 3; do
  if adb install -r "$APK_PATH"; then
    installed=true
    break
  fi
  echo "APK install attempt $attempt failed; reconnecting ADB before retry."
  adb kill-server || true
  adb start-server
  adb wait-for-device
  sleep 5
done
test "$installed" = "true"

adb shell am force-stop com.pixiestack.mobtaskmanager || true
adb shell am start -W -n com.pixiestack.mobtaskmanager/.MainActivity
sleep 8
pid="$(adb shell pidof com.pixiestack.mobtaskmanager | tr -d '\r')"
test -n "$pid"
echo "Android app launched successfully with PID $pid"
