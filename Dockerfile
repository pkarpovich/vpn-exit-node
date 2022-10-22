FROM node:lts-bullseye-slim AS pnpm

ARG PNPM_VERSION=7.6.0
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

FROM pnpm AS builder
WORKDIR /usr/app
COPY pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.pnpm-store\
     pnpm fetch
COPY . ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.pnpm-store \
     pnpm install --frozen-lockfile
RUN pnpm run build
RUN pnpm prune --prod

FROM tailscale/tailscale:stable
ENV NODE_ENV production
WORKDIR /usr/app

RUN apk add -U dumb-init nodejs

COPY package.json ./
COPY --from=builder /usr/app/dist ./
COPY --from=builder /usr/app/node_modules ./node_modules
COPY --from=builder /usr/app/scripts/entrypoint.sh /usr/bin/entrypoint.sh
RUN chmod +x /usr/bin/entrypoint.sh

#ENTRYPOINT ["dumb-init"]
CMD ["entrypoint.sh"]
