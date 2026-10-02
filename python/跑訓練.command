#!/bin/bash
cd "$(dirname "$0")"
python3 train.py "$@"
echo
read -n 1 -s -r -p "按任意鍵關閉…"
