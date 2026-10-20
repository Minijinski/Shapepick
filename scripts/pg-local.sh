#!/bin/sh
# Postgres local au projet, sans Docker : données dans .pgdata, port 54329.
# Usage : pnpm pg:local [start|stop|status]
set -e
DIR="$(cd "$(dirname "$0")/.." && pwd)/.pgdata"
PORT=54329
BIN="$(dirname "$(command -v pg_ctl 2>/dev/null || ls /opt/homebrew/opt/postgresql@*/bin/pg_ctl | tail -1)")"

case "${1:-start}" in
  start)
    if [ ! -d "$DIR" ]; then
      "$BIN/initdb" -D "$DIR" -U choose --auth=trust >/dev/null
    fi
    "$BIN/pg_ctl" -D "$DIR" -l "$DIR/server.log" -o "-p $PORT -k /tmp" -w start
    "$BIN/psql" -h localhost -p $PORT -U choose -d postgres -tc \
      "SELECT 1 FROM pg_database WHERE datname = 'choose_a_device'" | grep -q 1 ||
      "$BIN/createdb" -h localhost -p $PORT -U choose choose_a_device
    ;;
  stop) "$BIN/pg_ctl" -D "$DIR" stop ;;
  status) "$BIN/pg_ctl" -D "$DIR" status ;;
esac
