FROM node:alpine

WORKDIR /app

COPY package.json ./

RUN npm --omit=dev install

COPY . .

ENTRYPOINT ["node", "/app/index.js"]
