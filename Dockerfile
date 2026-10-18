# ---------- Stage 1: Build ----------
FROM node:22-alpine AS build

WORKDIR /app

# Copy package manifest and lockfile first for layer caching
COPY package.json bun.lock ./

# Install bun, then install ALL dependencies (including devDependencies needed for the build)
RUN npm install -g bun && bun install --frozen-lockfile

# Copy source files required for the Vite build
COPY src/ ./src/
COPY index.html ./
COPY vite.config.ts ./
COPY tsconfig.json ./
COPY server.ts ./

# Build the frontend (vite build -> dist/)
RUN bun run build

# ---------- Stage 2: Runtime ----------
FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

# Install wget for the container healthcheck (used by docker-compose healthcheck)
RUN apk add --no-cache wget

# Copy package manifest and lockfile
COPY package.json bun.lock ./

# Install bun, then install ALL dependencies.
# tsx (needed to run server.ts via `bun run start`) is in devDependencies,
# so we cannot use --production here — the runtime needs devDependencies too.
RUN npm install -g bun && bun install --frozen-lockfile

# Copy the built frontend assets from the build stage
COPY --from=build /app/dist ./dist

# Copy server entrypoint and tsconfig (tsx needs tsconfig for path resolution)
COPY server.ts ./
COPY tsconfig.json ./

# Create a non-root user and switch to it
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000

# `bun run start` executes `tsx server.ts`.
# With NODE_ENV=production, server.ts serves static files from dist/ and API routes.
CMD ["bun", "run", "start"]
