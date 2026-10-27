FROM node:22-alpine AS build
WORKDIR /build
RUN apk add --no-cache python3
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run bundle && npm run build

FROM nginx:1.28-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /build/dist /usr/share/nginx/html
COPY docker/runtime-live.js /usr/share/nginx/html/runtime.js
EXPOSE 80
