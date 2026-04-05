# syntax=docker/dockerfile:1
FROM oven/bun:1 AS build

WORKDIR /app
COPY package.json bun.lock ./
COPY packages/browser/package.json packages/browser/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/create/package.json packages/create/package.json
COPY packages/dht/package.json packages/dht/package.json
COPY packages/discovery/package.json packages/discovery/package.json
COPY packages/fixtures/package.json packages/fixtures/package.json
COPY packages/host-sdk/package.json packages/host-sdk/package.json
COPY packages/lsd/package.json packages/lsd/package.json
COPY packages/magnet/package.json packages/magnet/package.json
COPY packages/merkle-tree/package.json packages/merkle-tree/package.json
COPY packages/node/package.json packages/node/package.json
COPY packages/parse/package.json packages/parse/package.json
COPY packages/protocol/package.json packages/protocol/package.json
COPY packages/publish/package.json packages/publish/package.json
COPY packages/tracker/package.json packages/tracker/package.json
COPY packages/ut-metadata/package.json packages/ut-metadata/package.json
COPY packages/ut-pex/package.json packages/ut-pex/package.json
COPY packages/utils/package.json packages/utils/package.json
COPY examples/seed-server/package.json examples/seed-server/package.json
COPY examples/sintel-landing/package.json examples/sintel-landing/package.json
COPY examples/sintel-web/package.json examples/sintel-web/package.json
COPY examples/web-portal/package.json examples/web-portal/package.json
RUN bun install --frozen-lockfile

COPY turbo.json turbo.json
COPY packages/ packages/
COPY examples/web-portal/ examples/web-portal/
RUN bun run build -- --filter=@z-torrent/browser
RUN cd examples/web-portal && bun run build

FROM nginx:alpine
COPY examples/web-portal/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/examples/web-portal/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
