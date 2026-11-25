# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS build
WORKDIR /app/corsiqx-autodarts-rest-api
COPY ./corsiqx-autodarts-rest-api/package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY ./corsiqx-autodarts-rest-api/postgres-prisma ./postgres-prisma
COPY ./corsiqx-autodarts-rest-api/postgres-prisma.config.ts ./
RUN POSTGRES_DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    npx prisma generate --config postgres-prisma.config.ts
COPY ./corsiqx-autodarts-rest-api ./
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine AS production
RUN apk add --no-cache dumb-init openssl
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/corsiqx-autodarts-rest-api/node_modules ./node_modules
COPY --from=build /app/corsiqx-autodarts-rest-api/package*.json ./
COPY --from=build /app/corsiqx-autodarts-rest-api/dist ./dist
COPY --from=build /app/corsiqx-autodarts-rest-api/generated ./dist/corsiqx-autodarts-rest-api/generated
EXPOSE 80
CMD ["dumb-init", "node", "dist/corsiqx-autodarts-rest-api/src/main.js"]