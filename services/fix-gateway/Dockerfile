# FIX gateway + local bank simulator in one container (hosted demo).
# Build context: services/fix-gateway
FROM gradle:8.14.3-jdk21 AS build
WORKDIR /src
COPY . .
RUN gradle installDist --no-daemon -q

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /src/build/install/fix-gateway /app
COPY start-demo.sh /app/start-demo.sh
RUN chmod +x /app/start-demo.sh
# DATABASE_URL must point at the same PostgreSQL as the API.
CMD ["/app/start-demo.sh"]
