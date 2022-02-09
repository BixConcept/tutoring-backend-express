FROM node:17-alpine AS node

# Use /app as the CWD
WORKDIR /app            

# Copy package.json and package-lock.json to /app
COPY package*.json ./   

# Install all dependencies
RUN npm i               

# Copy the rest of the code
COPY . .                

# Open desired port
EXPOSE 5001

# Use js files to run the application
ENTRYPOINT ["npm", "run", "start"]
