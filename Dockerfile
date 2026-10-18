# ---------- Stage 1: builder ----------
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN npm install            # full install (includes devDependencies needed for build: vite, tsx, typescript, tailwind, etc.)
COPY . .
RUN npm run build          # produces dist/

# ---------- Stage 2: production ----------
FROM node:22-alpine
WORKDIR /app
# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
# Copy package.json + bun.lock, then do a FULL npm install (tsx is a devDependency required at runtime for 'npx tsx server.ts')
COPY package.json bun.lock ./
RUN npm install            # full install so tsx is available; do NOT use --production/--omit=dev
# Copy build artifacts and server source from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
# Also copy vite.config.ts and tsconfig.json since server.ts imports 'vite' and tsx may need tsconfig
COPY --from=builder /app/vite.config.ts ./vite.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
# Copy index.html (referenced by vite config / catch-all route)
COPY --from=builder /app/index.html ./index.html
# Set production environment
ENV NODE_ENV=production
ENV PORT=3000
# Run as non-root
USER appuser
EXPOSE 3000
# Health check — wget is available in alpine; target '/' since there is no /api/health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -qO- http://localhost:3000/ || exit 1
CMD ["npx", "tsx", "server.ts"]
