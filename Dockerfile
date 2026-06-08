FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATA_DIR=/app/data

COPY package.json ./
COPY index.html styles.css script.js server.js ./

RUN mkdir -p /app/data/uploads && chown -R node:node /app
USER node

EXPOSE 3000
CMD ["node", "server.js"]
