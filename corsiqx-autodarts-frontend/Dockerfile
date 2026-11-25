FROM node:22-alpine AS build
ARG c=production
WORKDIR /app
COPY ./corsiqx-autodarts-frontend/package*.json ./corsiqx-autodarts-frontend/
RUN cd corsiqx-autodarts-frontend && npm ci
COPY ./corsiqx-autodarts-frontend ./corsiqx-autodarts-frontend
RUN cd corsiqx-autodarts-frontend && npx ng build -c $c

FROM nginx:alpine
RUN rm /etc/nginx/conf.d/default.conf && rm /etc/nginx/nginx.conf
COPY ./corsiqx-autodarts-frontend/nginx/nginx.conf /etc/nginx/nginx.conf
COPY ./corsiqx-autodarts-frontend/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/corsiqx-autodarts-frontend/dist/corsiqx-autodarts-frontend/browser /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]