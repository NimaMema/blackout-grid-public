"""Exercise a running real stack, including outage/recovery and idempotency."""
import argparse
import json
import time
import urllib.error
import urllib.request
import uuid

parser = argparse.ArgumentParser()
parser.add_argument("--url", default="http://localhost:3000")
args = parser.parse_args()
base = args.url.rstrip("/")

def request(path, data=None, key=None):
    headers = {"Content-Type": "application/json"}
    if key: headers["Idempotency-Key"] = key
    req = urllib.request.Request(base + "/api/" + path,
        data=json.dumps(data).encode() if data is not None else None, headers=headers)
    with urllib.request.urlopen(req, timeout=15) as response:
        return json.load(response)

def until(check, timeout=90):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            value = check()
            if value: return value
        except (OSError, ValueError):
            pass
        time.sleep(.4)
    raise AssertionError("Timed out waiting for the real stack.")

normal = {"rate": 0, "paused": False, "delayMs": 120, "workers": 4, "gatewayDown": False}
until(lambda: request("health").get("product") == "BLACKOUT")
until(lambda: request("control", normal))
until(lambda: request("snapshot")["metrics"]["backlog"] == 0, 60)
key = str(uuid.uuid4())
first = request("jobs", {"payload": "integration test"}, key)
second = request("jobs", {"payload": "integration test"}, key)
assert first["id"] == second["id"] and second["duplicate"], "Idempotency failed."
until(lambda: any(j["id"] == first["id"] and j["status"] == "COMPLETED"
                  for j in request("snapshot")["jobs"]), 15)
print("PASS: real job processed; duplicate request reuses the same job.")

request("control", {**normal, "paused": True})
before = request("snapshot")["metrics"]
for i in range(8): request("jobs", {"payload": "outage test " + str(i)})
time.sleep(1)
after = request("snapshot")["metrics"]
assert after["backlog"] == before["backlog"] + 8
assert after["completed"] == before["completed"]
request("control", normal)
until(lambda: request("snapshot")["metrics"]["backlog"] == 0, 20)
print("PASS: stopping consumers retained all eight jobs; recovery drained them.")

request("control", {**normal, "gatewayDown": True})
try:
    request("jobs", {"payload": "should be rejected"})
    raise AssertionError("Offline gateway accepted a request.")
except urllib.error.HTTPError as exc:
    assert exc.code == 503
finally:
    request("control", {**normal, "rate": 3})
print("PASS: gateway outage returned HTTP 503 and recovered.")
