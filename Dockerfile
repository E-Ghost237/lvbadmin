# syntax=docker/dockerfile:1

# ---- build: compile the Angular (SSR) app -------------------------------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --fund=false

COPY . .
RUN npm run build

# ---- runtime: slim image that only serves the compiled output -----------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --fund=false

COPY --from=build /app/dist/lvbadmin ./dist/lvbadmin

ENV PORT=4000
EXPOSE 4000

CMD ["node", "dist/lvbadmin/server/server.mjs"]
