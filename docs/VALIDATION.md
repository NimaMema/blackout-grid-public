# Validation record

Checked on October 26, 2026.

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

The integration test launched the actual API jar, worker jar, H2 file database and a native RabbitMQ 3.12.1 broker together. It ran scripts/smoke.py over HTTP. The Java services used Spring Boot 3.5.16 on Java 17.

Docker is not installed in the build environment, so the Docker image builds and the RabbitMQ 4.1 image in compose.yaml were not executed here. The supplied GitHub Actions workflow performs those checks when the repository is pushed.

The browser used for visual QA did not provide WebGL. The interactive Canvas fallback was checked; the Three.js renderer's WebGL output could not be visually verified in that browser.

This record reports correctness checks, not a throughput benchmark.
