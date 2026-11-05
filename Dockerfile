# ---- Stage 1: install production dependencies only ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- Stage 2: final runtime image ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]