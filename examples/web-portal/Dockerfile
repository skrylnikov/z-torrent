# syntax=docker/dockerfile:1.7
FROM oven/bun:1 AS build

WORKDIR /app
COPY package.json bun.lock ./
COPY --parents packages/*/package.json ./
COPY --parents examples/*/package.json ./
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
