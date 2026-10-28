# BLACKOUT: LinkedIn and portfolio launch package

Creator: **Nima Memarahari** ([@NimaMema](https://github.com/NimaMema))

Every claim below is backed by code and tests in this repository. Nothing here has been posted.
The demo link works only after GitHub Pages is enabled and the **GitHub Pages demo** workflow
has been run (see the README).

**Assets**
- LinkedIn thumbnail (1200×627): [`linkedin-thumbnail.png`](linkedin-thumbnail.png)
- GitHub social preview (1280×640, upload in **Settings → General → Social preview**): [`social-preview.png`](social-preview.png)
- Screenshots: [`../screenshots/`](../screenshots/). `02-worker-blackout.png` works well as a second post image.
- Recording plan for a 30-second video: [`../DEMO.md`](../DEMO.md)

Regenerate the images with `node scripts/capture-screenshots.mjs` (see the comment at the top of that script).

---

## 1. Launch post

> ⚡ **What does a backend outage look like? I built a city to find out.**
>
> BLACKOUT is an asynchronous job pipeline you can break on purpose. Every part of it is a district in a 3D city: requests are moving lights, a worker outage darkens a district, and queued work piles up as a glowing backlog that drains when the consumers come back.
>
> Under the city is a real system:
> 🔹 A **Spring Boot** API that saves each job and its **outbox** record in one transaction
> 🔹 A publisher that waits for **RabbitMQ publisher confirms** and retries anything unconfirmed
> 🔹 **Java workers** that commit their result *before* acknowledging the message, with an **idempotent completion** update, so a redelivery can't be counted twice
> 🔹 **Idempotency keys**, so a retried request returns the same job
>
> You can stop the consumers, surge the traffic, slow the workers or take the gateway down (it returns real HTTP 503s), then restore the grid and watch every accepted job drain.
>
> The honest part: it's **at-least-once delivery with idempotent completion**, not "exactly-once". It runs a single API instance. And the hosted demo is a clearly labelled in-browser simulation. The full Java + RabbitMQ stack runs locally with one `docker compose up`.
>
> 👉 Try the browser demo: https://nimamema.github.io/blackout-grid-public/
> 💻 Source: https://github.com/NimaMema/blackout-grid-public
>
> It's a companion to BLACKGUARD, my local-first security monitoring project. One is about detecting when things go wrong, the other about designing systems that survive it.
>
> #java #springboot #rabbitmq #distributedsystems #backend #threejs #softwareengineering #opensource

*(About 1,550 characters, comfortably within LinkedIn's 3,000-character limit.)*

---

## 2. Short version (for a comment, a repost or X/Bluesky)

> Built BLACKOUT: break a Java + RabbitMQ job pipeline and watch a 3D city react. Transactional outbox, publisher confirms, ack-after-commit, idempotent completion. Browser demo: https://nimamema.github.io/blackout-grid-public/ · Code: https://github.com/NimaMema/blackout-grid-public

---

## 3. LinkedIn "Projects" section entry

**Name:** BLACKOUT: Infrastructure City

**Description** (about 900 characters, within the 2,000 limit):

> An interactive distributed-systems lab that visualises a real asynchronous job pipeline as a 3D city. A Spring Boot API persists jobs and outbox records in one H2 transaction. An outbox publisher delivers them to RabbitMQ with publisher confirms and retries. Java workers do SHA-256 work, commit results through an idempotent completion callback, and only then acknowledge the message, giving at-least-once delivery without double counting. Users inject failures (consumer outage, traffic surge, slow workers, gateway 503s) and watch backlog, P95 latency and acceptance rate respond. Frontend in vanilla JS with Three.js and a Canvas fallback. Four-service Docker Compose stack. Tested with JUnit/Mockito, node:test and an HTTP smoke test against the real stack, with CI on GitHub Actions. A static GitHub Pages build provides a clearly labelled in-browser simulation.

**Skills:** Java · Spring Boot · RabbitMQ · Distributed Systems · Docker · Three.js · JavaScript · REST APIs · Software Testing · GitHub Actions

**Link:** https://github.com/NimaMema/blackout-grid-public (thumbnail: `linkedin-thumbnail.png`)

---

## 4. Talking points for interviews

- **Why an outbox?** Without it, "save the job" and "publish the message" are two separate writes, and a crash between them loses or orphans work.
- **Why confirms *and* an outbox?** The outbox makes publishing retryable. Confirms tell you when it's safe to stop retrying.
- **Why commit before ack?** Acking first risks losing a result. Committing first risks a duplicate, which the `completed_at IS NULL` guard absorbs. Duplicates are recoverable; losses aren't.
- **What would change for multiple API replicas?** A shared database, and coordinated outbox publishing (row locking or `SELECT … FOR UPDATE SKIP LOCKED`) so two publishers don't race.
- **How do you keep a demo honest?** The UI labels its mode everywhere, live mode never falls back to simulated numbers, and the hosted build can't pretend to connect.

---

## Pre-posting checklist

- [ ] Merge the portfolio PR.
- [ ] Enable Pages (**Settings → Pages → Source: GitHub Actions**) and run **Actions → GitHub Pages demo → Run workflow**.
- [ ] Open the demo link in a private window and check it loads in **BROWSER DEMO** mode.
- [ ] Upload `social-preview.png` in **Settings → General → Social preview**.
- [ ] Add a repository description and topics, for example *java, spring-boot, rabbitmq, distributed-systems, threejs, outbox-pattern*.
