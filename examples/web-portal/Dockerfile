# syntax=docker/dockerfile:1
FROM oven/bun:1 AS build

WORKDIR /app
COPY package.json bun.lock ./
COPY packages/browser/package.json packages/browser/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/parse/package.json packages/parse/package.json
COPY packages/protocol/package.json packages/protocol/package.json
COPY packages/create/package.json packages/create/package.json
COPY packages/utils/package.json packages/utils/package.json
COPY examples/web-portal/package.json examples/web-portal/package.json
RUN bun install --frozen-lockfile

COPY packages/ packages/
COPY examples/web-portal/ examples/web-portal/
RUN bun run build -- --filter=@z-torrent/browser
RUN cd examples/web-portal && bun run build

FROM nginx:alpine
COPY examples/web-portal/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/examples/web-portal/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
