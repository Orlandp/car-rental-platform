"""Proves the double-booking race condition is actually closed under real concurrency.

Flask's dev server (`python run.py`) is single-threaded, so hitting it "concurrently"
just queues requests - it can't demonstrate whether the row lock in
`app.routes.bookings._build_booking` (`Vehicle.query.with_for_update()`) genuinely
serializes concurrent bookings, or whether the app only looks correct because requests
never actually overlap. This script proves it with real OS-level concurrency: N
requests fired from N threads, released at the same instant via a threading.Barrier,
against a Gunicorn instance running multiple *worker processes* (separate DB
connections, real parallelism) backed by a real Postgres database (SQLite's
`with_for_update()` is a silent no-op - this test is meaningless against it).

Usage:
    cd backend && source venv/bin/activate
    set -a && source .env && set +a
    gunicorn -w 4 -b 127.0.0.1:8030 "run:app" &
    python3 scripts/verify_race_condition.py
    kill %1

Creates its own throwaway verified renter accounts (racer1..racerN) and vehicle if
needed. Exits non-zero if more than one booking succeeds for the same vehicle/dates.
"""

import http.client
import json
import os
import sys
import threading

# Let this run as `python3 scripts/verify_race_condition.py` from backend/ without
# needing PYTHONPATH set - Python only puts the script's own directory on sys.path.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

HOST = os.environ.get("RACE_TEST_HOST", "127.0.0.1")
PORT = int(os.environ.get("RACE_TEST_PORT", "8030"))
N = int(os.environ.get("RACE_TEST_RACERS", "5"))
START = os.environ.get("RACE_TEST_START", "2029-07-01")
END = os.environ.get("RACE_TEST_END", "2029-07-05")


def _setup_racers_and_vehicle():
    """Creates N verified renter accounts and one vehicle to book, directly via the app
    context (bypassing HTTP) since this is test fixture setup, not part of the race."""
    from dotenv import load_dotenv

    load_dotenv()
    from app import create_app
    from app.config import Config
    from app.extensions import db

    app = create_app(Config)
    with app.app_context():
        from app.models.user import ROLE_CLIENT, VERIFICATION_VERIFIED, User
        from app.models.vehicle import STATUS_AVAILABLE, TYPE_FUEL_CAR, Vehicle

        vehicle = Vehicle.query.filter_by(name="Race Test Vehicle").first()
        if not vehicle:
            vehicle = Vehicle(
                name="Race Test Vehicle",
                type=TYPE_FUEL_CAR,
                price_per_day=1000,
                status=STATUS_AVAILABLE,
            )
            db.session.add(vehicle)
            db.session.commit()

        for i in range(1, N + 1):
            uname = f"racer{i}"
            user = User.query.filter_by(username=uname).first()
            if not user:
                user = User(
                    name=uname.title(),
                    username=uname,
                    email=f"{uname}@example.com",
                    phone=f"25471100{i:04d}",
                    role=ROLE_CLIENT,
                )
                user.set_password("password123")
                db.session.add(user)
            user.verification_status = VERIFICATION_VERIFIED
        db.session.commit()
        return vehicle.id


def _login(username, password):
    conn = http.client.HTTPConnection(HOST, PORT)
    body = json.dumps({"username": username, "password": password})
    conn.request("POST", "/api/auth/login", body, {"Content-Type": "application/json"})
    res = conn.getresponse()
    res.read()
    if res.status != 200:
        raise RuntimeError(f"login failed for {username}: HTTP {res.status}")
    cookie = res.getheader("Set-Cookie").split(";")[0]
    conn.close()
    return cookie


def main():
    vehicle_id = _setup_racers_and_vehicle()
    barrier = threading.Barrier(N)
    results = {}

    def book(name, cookie):
        conn = http.client.HTTPConnection(HOST, PORT)
        body = json.dumps({"vehicle_id": vehicle_id, "start_date": START, "end_date": END})
        headers = {"Content-Type": "application/json", "Cookie": cookie}
        barrier.wait()  # release every thread at the same instant
        conn.request("POST", "/api/bookings", body, headers)
        res = conn.getresponse()
        res.read()
        results[name] = res.status
        conn.close()

    cookies = {f"racer{i}": _login(f"racer{i}", "password123") for i in range(1, N + 1)}
    threads = [threading.Thread(target=book, args=(name, c)) for name, c in cookies.items()]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    print(f"{N} simultaneous booking attempts for vehicle {vehicle_id}, {START} to {END}:")
    print(" ", results)

    successes = [n for n, s in results.items() if s == 201]
    rejections = [n for n, s in results.items() if s == 400]
    unexpected = {n: s for n, s in results.items() if s not in (201, 400)}

    ok = len(successes) == 1 and len(rejections) == N - 1 and not unexpected
    print(f"successes={len(successes)} rejections={len(rejections)} unexpected={unexpected}")
    print("PASS - no double-booking under real concurrency" if ok else "FAIL")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
