# syntax=docker/dockerfile:1
# Build context: repository root (docker build -f examples/sintel-landing/Dockerfile .)
FROM oven/bun:1 AS builder

WORKDIR /app

COPY . .

RUN bun install --frozen-lockfile
RUN bun run build -- --filter=sintel-landing

# --- Runtime stage ---
FROM nginx:alpine

COPY --from=builder /app/examples/sintel-landing/dist /usr/share/nginx/html
COPY examples/sintel-landing/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
