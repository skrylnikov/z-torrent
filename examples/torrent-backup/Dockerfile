# syntax=docker/dockerfile:1
# Build context: repository root (docker build -f examples/torrent-backup/Dockerfile .)
FROM oven/bun:1

WORKDIR /app

# Install build tools for native deps (utp-native)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

COPY . .

RUN bun install --frozen-lockfile

WORKDIR /app/examples/torrent-backup

EXPOSE 8080

CMD ["bun", "run", "src/index.ts"]
