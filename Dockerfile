FROM node:22-alpine

RUN apk add --no-cache fontconfig ttf-liberation postgresql16-client

WORKDIR /app

COPY package*.json ./
RUN npm ci --include=dev

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=2359

EXPOSE 2359

CMD ["npm", "start"]
