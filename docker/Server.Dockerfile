FROM maven:3.9.11-eclipse-temurin-17 AS build
WORKDIR /build
COPY server/ .
ARG MODULE=api
RUN mvn -B -pl "$MODULE" -am package -DskipTests
RUN cp "$MODULE/target/$MODULE-1.0.0.jar" /build/app.jar

FROM eclipse-temurin:17-jre
WORKDIR /app
RUN mkdir -p /app/data && chown -R 10001:10001 /app
COPY --from=build --chown=10001:10001 /build/app.jar /app/app.jar
USER 10001
ENTRYPOINT ["java","-XX:MaxRAMPercentage=65","-jar","/app/app.jar"]
