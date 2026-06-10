FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache tzdata
ENV TZ=Africa/Algiers
COPY --from=build /app/node_modules ./node_modules
COPY package*.json server.js ./
COPY src/ ./src/
COPY migrations/ ./migrations/
EXPOSE 3000
USER node
CMD ["node", "server.js"]
