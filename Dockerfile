# ---------- Stage 1: Builder (install all deps + build frontend) ----------
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package manifest and lockfile first for layer caching.
# NOTE: The project uses bun.lock (no package-lock.json), so we use
# "npm install" rather than "npm ci" (which requires package-lock.json).
COPY package.json bun.lock ./

# Install ALL dependencies (including devDependencies needed for the build:
# vite, @vitejs/plugin-react, tailwindcss, typescript, etc.)
RUN npm install

# Copy the full source tree
COPY . .

# Build the Vite frontend into dist/
RUN npm run build

# ---------- Stage 2: Production runtime ----------
FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy package manifest and lockfile, then install only production deps.
# Runtime needs: express, ws, @google/genai, dotenv, tsx (devDep but required
# to execute server.ts directly). We install without --omit=dev first, then
# the tsx runtime is available. However, to keep the image lean while still
# being able to run "npx tsx server.ts", we install production deps plus tsx.
COPY package.json bun.lock ./
RUN npm install --omit=dev && npm install tsx

# Copy the built frontend assets from the builder stage
COPY --from=builder /app/dist ./dist

# Copy the runtime entrypoint and TypeScript config.
# server.ts is executed directly via tsx (not compiled to JS first).
# tsconfig.json is needed by tsx for path/module resolution.
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Create a non-root user and grant ownership of the app directory
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

# Healthcheck: server.ts has no /health endpoint, but in production mode the
# catch-all route serves index.html with a 200 status for any path.
# Use Node.js built-in fetch() (Alpine has no curl).
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["npx", "tsx", "server.ts"]
