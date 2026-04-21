FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3002
ENV HOSTNAME=0.0.0.0
RUN apk add --no-cache wget python3 make g++

COPY --from=builder /app/build ./build
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/migrate.js ./migrate.js
COPY --from=builder /app/scripts ./scripts

RUN mkdir -p /app/data/uploads/ktp /app/data/uploads/payment /app/data/uploads/complaint

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:3002/api/health || exit 1

EXPOSE 3002
CMD ["sh", "-c", "node migrate.js && npm start"]
