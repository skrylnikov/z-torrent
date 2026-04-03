# syntax=docker/dockerfile:1
# Build context: repository root (docker build -f examples/seed-server/Dockerfile .)
FROM oven/bun:1 AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

COPY . .

RUN bun install --frozen-lockfile
RUN bun run build -- --filter=@z-torrent/node

FROM oven/bun:1 AS runner

WORKDIR /app

COPY --from=builder /app /app

WORKDIR /app/examples/seed-server

EXPOSE 8080
EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]
