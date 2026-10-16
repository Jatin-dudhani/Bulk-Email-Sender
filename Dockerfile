# Production Multi-Stage Dockerfile for Bulk Email Sender
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --silent
COPY frontend/ ./
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5001

COPY backend/package*.json ./backend/
RUN cd backend && npm ci --only=production --silent

COPY backend/ ./backend/
COPY --from=frontend-builder /app/frontend/build ./frontend/build

EXPOSE 5001
CMD ["node", "backend/server.js"]
