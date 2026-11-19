# syntax=docker/dockerfile:1.4
FROM node:20-bookworm-slim

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY package.json ./
RUN pnpm install --ignore-workspace

COPY . .
RUN --mount=type=secret,id=cms_env,target=/app/.env.local pnpm run build

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
EXPOSE 3000
CMD ["pnpm", "run", "start"]
