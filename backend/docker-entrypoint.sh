#!/usr/bin/env sh
set -e

echo "Waiting for the database to accept connections..."
python <<'PY'
import os
import sys
import time

import sqlalchemy

url = os.environ["DATABASE_URL"]
engine = sqlalchemy.create_engine(url)

for attempt in range(30):
    try:
        with engine.connect():
            print("Database is up.")
            break
    except Exception as exc:  # noqa: BLE001 - just retrying on any connection error
        print(f"Database not ready yet ({exc}); retrying in 2s...")
        time.sleep(2)
else:
    print("Database never became available.", file=sys.stderr)
    sys.exit(1)
PY

echo "Running database migrations..."
flask db upgrade

echo "Starting gunicorn..."
exec gunicorn -w 4 -b 0.0.0.0:5000 --access-logfile - --error-logfile - "run:app"
