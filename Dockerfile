FROM node:17-alpine AS node


# Builder stage

FROM node AS builder

# Use /app as the CWD
WORKDIR /app            

# Copy package.json and package-lock.json to /app
COPY package*.json ./   

# Install all dependencies
RUN npm i               

# Copy the rest of the code
COPY . .                

# Invoke the build script to transpile code to js
RUN npm run build       


# Final stage


FROM node:17 AS final

# Prepare a destination directory for js files
RUN mkdir -p /app/build                  

# Use /app as CWD
WORKDIR /app                            

# Copy package.json and package-lock.json
COPY package*.json ./                   

# Install only production dependencies
RUN npm i --only=production             

# Copy transpiled js from builder stage into the final image
COPY --from=builder /app/build ./build

# Open desired port
EXPOSE 5001

# Use js files to run the application
ENTRYPOINT ["node", "./build/src/index.js"]
