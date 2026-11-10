FROM node:22-alpine

ARG BUILD_REVISION=unknown
ARG BUILD_CREATED_AT=unknown

LABEL org.opencontainers.image.revision="${BUILD_REVISION}" \
      org.opencontainers.image.created="${BUILD_CREATED_AT}"

RUN apk add --no-cache fontconfig ttf-liberation postgresql16-client

WORKDIR /app

COPY package*.json ./
RUN npm ci --include=dev

COPY . .
RUN npm run build

ENV BUILD_REVISION="${BUILD_REVISION}" BUILD_CREATED_AT="${BUILD_CREATED_AT}"
ENV NODE_ENV=production
ENV APP_PROFILE=pcn
ENV PORT=2357

EXPOSE 2357

CMD ["npm", "start"]
