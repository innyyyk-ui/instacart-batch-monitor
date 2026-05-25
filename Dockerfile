FROM node:18

# Install dependencies for Puppeteer
RUN apt-get update && apt-get install -y \
    ca-certificates \
    fonts-dejavu-core \
    fonts-liberation \
    fonts-noto-cjk \
    fonts-noto-mono \
    fonts-noto-noto \
    fonts-open-sans \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libcurl4 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libfreetype6 \
    libgcc-s1 \
    libglib2.0-0 \
    libglib2.0-bin \
    libgl1-mesa-glx \
    libgobject-2.0-0 \
    libgssapi-krb5-2 \
    libgtk-3-0 \
    libicu72 \
    libjpeg62-turbo \
    libkrb5-3 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libpixman-1-0 \
    libpng16-16 \
    libpulse0 \
    libre2-9 \
    libssl3 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxft2 \
    libxi6 \
    libxinerama1 \
    libxkbcommon0 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    wget \
    xdg-utils \
    zlib1g \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

CMD ["npm", "start"]FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy app
COPY . .

# Expose port
EXPOSE 3000

# Start app
CMD ["npm", "start"]
