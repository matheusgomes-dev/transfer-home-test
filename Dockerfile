# 1. Stage: Build the React client (assuming a simple vite setup)
FROM node:20-alpine AS build-stage
WORKDIR /app

# Copy client-side files
COPY client/package*.json client/
RUN cd client && npm install

# Copy source code and build the React app
COPY client/ client/
# NOTE: Replace 'npm run build' with your actual client build command (e.g., 'vite build')
RUN cd client && npm run build 


# 2. Stage: Production Node server
FROM node:20-alpine AS production-stage
WORKDIR /app

# Copy server-side files
COPY package*.json ./
RUN npm install --only=production

# Copy the server file
COPY src ./src

# Copy the built React client from the build stage
COPY --from=build-stage /app/client/dist ./client/dist

# Expose the port defined in the .env file (default 3001)
EXPOSE 3001

# Command to run the application
CMD ["node", "src/server.js"]
