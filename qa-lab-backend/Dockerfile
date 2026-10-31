FROM node:22-alpine AS deps
WORKDIR /app/backend
COPY qa-lab-backend/package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

FROM node:22-alpine AS build
WORKDIR /app/backend
COPY qa-lab-backend/package*.json ./
RUN npm ci || npm install
COPY qa-lab-backend/ ./
RUN npx prisma generate && npm run build

FROM node:22-alpine
WORKDIR /app
# Scanner library (CommonJS) mounted beside backend
COPY src /app/scanner
COPY --from=deps /app/backend/node_modules /app/backend/node_modules
COPY --from=build /app/backend/dist /app/backend/dist
COPY --from=build /app/backend/package.json /app/backend/
COPY --from=build /app/backend/prisma /app/backend/prisma
COPY --from=build /app/backend/src/generated /app/backend/src/generated
ENV NODE_ENV=production
ENV QA_LAB_SCANNER_ROOT=/app/scanner/lib
WORKDIR /app/backend
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
