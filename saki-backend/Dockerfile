# ---- build ---------------------------------------------------------------
FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /workspace

# Resolve dependencies first so code-only changes reuse this layer.
COPY pom.xml .
RUN mvn -B -q dependency:go-offline

COPY src ./src
# Tests run in CI / locally (`mvn test`); the image build only packages.
RUN mvn -B -q package -DskipTests

# ---- runtime -------------------------------------------------------------
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

RUN groupadd --system saki && useradd --system --gid saki --home /app saki
COPY --from=build /workspace/target/saki-backend-*.jar /app/saki-backend.jar
USER saki

# JVM flags; free hosts with 512 MB RAM override this (see render.yaml).
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError"
EXPOSE 8080
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/saki-backend.jar"]
