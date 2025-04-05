# Build stage for frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package*.json frontend/
WORKDIR /app/frontend
RUN npm install
COPY frontend/ .
RUN npm run build

# Final stage
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies including nginx
RUN apt-get update && apt-get install -y \
    unzip \
    nginx \
    && rm -rf /var/lib/apt/lists/*

# Configure nginx
COPY nginx.conf /etc/nginx/nginx.conf
RUN mkdir -p /var/log/nginx && \
    chown -R www-data:www-data /var/log/nginx && \
    mkdir -p /var/lib/nginx/body && \
    chown -R www-data:www-data /var/lib/nginx

# Copy backend requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create necessary directories
RUN mkdir -p /app/static /app/uploads && \
    chown -R www-data:www-data /app/uploads

# Copy backend code and built frontend
COPY . .
COPY --from=frontend-builder /app/static /app/static

# Set permissions
RUN chown -R www-data:www-data /app/static

# Create startup script
RUN echo '#!/bin/bash\n\
nginx\n\
gunicorn --bind 127.0.0.1:5000 --workers 4 --timeout 300 --max-requests 1000 --max-requests-jitter 50 app:app' > /app/start.sh && \
    chmod +x /app/start.sh

# Expose ports
EXPOSE 80

# Run the application
CMD ["/app/start.sh"]