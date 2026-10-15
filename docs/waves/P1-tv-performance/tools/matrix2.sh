#!/bin/bash
# usage: matrix2.sh <tag> [scenarios] ; fresh app process per run; base (4175) vs final (4174)
ADB=/c/Users/kazda/scoop/apps/android-clt/current/platform-tools/adb.exe; D="-s 10.0.0.139:5555"
tag=$1; scen=${2:-"training tiro3 stress menu"}
launch() {
  focus=$($ADB $D shell dumpsys window | grep mFocusedApp)
  case "$focus" in *deathride*|*telestrator*) echo "STOP: other session on TV: $focus"; exit 2;; esac
  $ADB forward --remove tcp:9222 2>/dev/null
  $ADB $D shell am start -S -n dev.magearena.tv/.MainActivity --es url "'http://127.0.0.1:$1/training?harness'" >/dev/null
  sleep 5; P=$($ADB $D shell pidof dev.magearena.tv); $ADB forward tcp:9222 localabstract:webview_devtools_remote_$P >/dev/null
  sleep 3; $ADB $D shell input keyevent --longpress KEYCODE_MENU; sleep 1
}
for sc in $scen; do
  for build in base final; do
    port=4174; [ $build = base ] && port=4175
    launch $port
    BASE=http://127.0.0.1:$port node bench.mjs $tag-$build $sc 600 2>&1 | grep -E "^\{|PAGEERROR|Error" | tail -2
    echo "MEM $tag-$build $sc GL=$($ADB $D shell dumpsys meminfo dev.magearena.tv | grep 'GL mtrack' | awk '{print $3}')kB avail=$($ADB $D shell cat /proc/meminfo | grep MemAvailable | awk '{print $2}')kB alive=$($ADB $D shell pidof dev.magearena.tv)"
  done
done
