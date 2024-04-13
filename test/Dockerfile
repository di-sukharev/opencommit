FROM ubuntu:latest

RUN apt-get update && apt-get install -y curl git

# Install Node.js v20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
RUN apt-get install -y nodejs

# Setup git
RUN git config --global user.email "test@example.com"
RUN git config --global user.name "Test User"

COPY . /app
WORKDIR /app

RUN ls -la

RUN npm install
RUN npm run build
