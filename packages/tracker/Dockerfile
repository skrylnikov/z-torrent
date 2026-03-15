# syntax=docker/dockerfile:1
# Build context: repository root (docker build -f packages/bittorrent-tracker/Dockerfile .)
FROM oven/bun:1 AS builder

WORKDIR /app

COPY . .

RUN bun install --frozen-lockfile
RUN bun run build -- --filter=bittorrent-tracker

# --- Runtime stage ---
FROM oven/bun:1-slim

WORKDIR /app

COPY --from=builder /app/package.json /app/bun.lock ./
COPY --from=builder /app/packages/bittorrent-tracker/ ./packages/bittorrent-tracker/
COPY --from=builder /app/packages/string2compact/ ./packages/string2compact/
COPY --from=builder /app/packages/addr-to-ip-port/ ./packages/addr-to-ip-port/
COPY --from=builder /app/node_modules/ ./node_modules/

WORKDIR /app/packages/bittorrent-tracker

EXPOSE 8000

ENV PORT=8000

CMD ["bun", "run", "dist/bin/cmd.js", "-p", "8000"]
