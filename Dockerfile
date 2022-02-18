FROM node:17

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 5001

RUN npm run build
CMD ["node", "build/index.js"]
