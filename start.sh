#!/bin/bash
# 啟動果蠅腦模擬（本機）
cd "$(dirname "$0")"
pkill -f "FlyBrain/server.py" 2>/dev/null; pkill -f "http.server 8899" 2>/dev/null
sleep 1
# 這台 Mac 目前 IPv4 loopback 不通，所以綁 IPv6 的 ::1
nohup python3 server.py > /tmp/flybrain.log 2>&1 &
sleep 2
echo "已啟動。請在瀏覽器打開："
echo "  http://[::1]:8899/index.html"
open "http://[::1]:8899/index.html"
