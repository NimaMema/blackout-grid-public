# Validation record

## October 28, 2026: portfolio and GitHub Pages release

| Check | Result |
| --- | --- |
| Browser-model tests (`npm test`) | 7 passed |
| Java tests (`mvn -f server/pom.xml verify`): JobStore 6, OutboxPublisher 3, Work 2 | 11 passed |
| Production build (`npm run build`) | Passed |
| GitHub Pages build (`npm run build:pages`) + `scripts/check-pages.mjs` | Passed, all 8 asset references resolve under `/blackout-grid-public/` |
| Production build contains no hosted-demo code | Checked |
| Real-stack smoke test (`scripts/smoke.py --url http://localhost:8080`) | Passed: idempotent duplicate, completed job, 8 jobs retained through a consumer outage and drained, HTTP 503 gateway outage and recovery |
| Three.js WebGL renderer, desktop 1440 px (live backend) | Checked visually (headless Chromium) |
| Phone-width layout, 390 px (hosted build) | Checked visually |
| Hosted-build environment dialog hides "connect to Java API" | Checked |

Environment: Node 22, OpenJDK 21 (the project targets Java 17), Spring Boot 3.5.16, RabbitMQ 4.1 from
the `rabbitmq:4.1-management` image used by `compose.yaml`. The API and worker ran as the Maven-built
jars against that broker, with an H2 file database.

**Not run here:** `docker compose up --build` for the `api`, `worker` and `web` images. The build
environment's containers couldn't resolve package mirrors (Alpine, Maven Central), so the image
builds failed before reaching project code. The **Verify BLACKOUT** GitHub Actions workflow builds those
images and runs the smoke test through nginx on every push.

This record covers correctness checks, not a throughput benchmark.

## October 26, 2026: initial release

| Check | Result |
| --- | --- |
| Browser-model tests | 7 passed |
| Java persistence tests | 6 passed |
| Java outbox confirmation/retry tests | 3 passed |
| Java worker work/configuration tests | 2 passed |
| Vite production build | Passed |
| Real submission and duplicate idempotency | Passed |
| Stop consumers, retain 8 jobs, resume and drain | Passed |
| Gateway outage returns HTTP 503, then recovers | Passed |
| Desktop browser controls and request inspector | Checked |
| Phone-width layout and label spacing | Checked at 390px |

The integration test ran the actual API jar, worker jar, H2 file database and a native RabbitMQ 3.12.1
broker together, driven by `scripts/smoke.py` over HTTP. At that time WebGL wasn't available in the QA
browser, so only the Canvas fallback was checked visually.
