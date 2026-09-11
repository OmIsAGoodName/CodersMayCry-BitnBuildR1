# Multi-stage Dockerfile for Vendora Sovereign Offline Order System
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@11.9.0

# Copy manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json ./
COPY artifacts/orders-app/package.json ./artifacts/orders-app/
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY lib/db/package.json ./lib/db/
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY lib/api-spec/package.json ./lib/api-spec/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY scripts/package.json ./scripts/

# Install dependencies
RUN pnpm install --frozen-lockfile --config.confirmModulesPurge=false

# Copy source code
COPY . .

# Build frontend and backend
RUN pnpm --filter @workspace/orders-app build

# Production runtime stage
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5173

# Copy production static assets
COPY --from=builder /app/artifacts/orders-app/dist/public ./public
COPY scripts/ ./scripts/
COPY package.json ./

# Install lightweight static file server
RUN npm install -g serve

EXPOSE 5173

CMD ["serve", "-s", "public", "-l", "5173"]
