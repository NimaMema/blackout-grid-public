# A 30-second BLACKOUT recording

1. Start in Live Java mode with a healthy city.
2. Show the header and metrics so the environment is clear.
3. Trigger Worker blackout. Point out that accepted jobs accumulate while consumers stop.
4. Enable Traffic surge for a few seconds.
5. Restore the grid. Show the worker district returning and the backlog draining.
6. Open the request inspector and show completed jobs.
7. End with the repository and the architecture diagram.

For a no-install version, record the [hosted browser demo](https://nimamema.github.io/blackout-grid-public/) instead, and keep its **BROWSER DEMO** label in frame so viewers know the numbers are simulated.

Suggested on-screen labels:

- “A city powered by a real Java job pipeline.”
- “Stop consumers → queued work accumulates.”
- “Restore consumers → backlog drains.”
- “Spring Boot · RabbitMQ · transactional outbox · Three.js”

Use real output from your own run. Avoid quoting performance figures until you measure them on a stated machine and workload.
