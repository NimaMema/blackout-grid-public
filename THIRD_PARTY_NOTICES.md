# Third-party notices

BLACKOUT's own code is MIT-licensed (see [LICENSE](LICENSE)). It builds on the components below.
None of them is modified. Only three.js is redistributed in the built frontend (including the
GitHub Pages demo); the others are fetched by Maven, npm or Docker at build time, or loaded by
the visitor's browser.

| Component | Used for | License | Distributed here? |
| --- | --- | --- | --- |
| [three.js](https://github.com/mrdoob/three.js) 0.180.0 (incl. `OrbitControls`) | WebGL city renderer | MIT | Yes, bundled into `dist/assets/*.js` |
| [Vite](https://github.com/vitejs/vite) | Frontend build tool | MIT | No (build only) |
| [Spring Boot](https://github.com/spring-projects/spring-boot), [Spring AMQP](https://github.com/spring-projects/spring-amqp) | Java API and worker | Apache 2.0 | No (resolved by Maven) |
| [H2 Database](https://github.com/h2database/h2database) | Job and outbox storage | MPL 2.0 / EPL 1.0 | No (resolved by Maven) |
| [RabbitMQ](https://github.com/rabbitmq/rabbitmq-server) (`rabbitmq:4.1-management` image) | Message broker | MPL 2.0 | No (pulled by Docker) |
| [JUnit 5](https://github.com/junit-team/junit5), [Mockito](https://github.com/mockito/mockito) | Java tests | EPL 2.0 / MIT | No (test only) |
| [Barlow Condensed](https://github.com/jpt/barlow), [DM Sans](https://github.com/googlefonts/dm-fonts), [IBM Plex Mono](https://github.com/IBM/plex) | Typography | SIL Open Font License 1.1 | No (loaded from Google Fonts at runtime) |

The favicon, the screenshots and the social/thumbnail images in `docs/` are original to this
project.

## three.js license

```
The MIT License

Copyright © 2010-2025 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```
