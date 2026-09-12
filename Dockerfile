# Multi-stage build for the NestJS API (also used by docker-compose api service)
FROM node:22-alpine AS build
WORKDIR /repo

RUN corepack enable

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/

RUN pnpm install --frozen-lockfile --filter @tpb/api...

COPY packages ./packages
COPY apps/api ./apps/api

RUN pnpm --filter @tpb/contracts build \
 && pnpm --filter @tpb/api prisma:generate \
 && pnpm --filter @tpb/api build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable

COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/prisma ./prisma
COPY --from=build /repo/apps/api/package.json ./package.json

# Run as non-root: node:22-alpine ships a 'node' user (uid 1000).
# /data/uploads is pre-chowned so fresh named volumes inherit ownership.
RUN chown -R node:node /app \
 && mkdir -p /data/uploads && chown -R node:node /data/uploads
ENV NPM_CONFIG_CACHE=/tmp/npm-cache
USER node

EXPOSE 3000
CMD ["node", "dist/main.js"]
