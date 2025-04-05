# Slack RMSF Browser

A Dockerized Flask application that allows browsing and searching through Slack RMSF export files. The application provides a Slack-like interface with channel navigation and advanced search capabilities.

## Features

- Upload and parse Slack RMSF export ZIP files
- Channel-based navigation
- Advanced search with regex support
- Slack-like interface
- Dockerized for easy deployment

## Prerequisites

- Docker and Docker Compose
- Node.js (for local development)

## Getting Started

### Using Docker (Recommended)

1. Clone the repository
2. Build and start the containers:
   ```bash
   docker-compose up --build
   ```
3. Access the application at `http://localhost:5000`

### Local Development

1. Clone the repository
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Install frontend dependencies:
   ```bash
   cd frontend
   npm install
   ```
4. Start the backend:
   ```bash
   python app.py
   ```
5. In a separate terminal, start the frontend:
   ```bash
   cd frontend
   npm run dev
   ```
6. Access the application at `http://localhost:5173`

## Usage

1. Upload a Slack RMSF export ZIP file using the file upload button
2. Browse channels using the sidebar
3. Use the search box to search through messages
   - Supports regular expressions
   - Filter by channel by selecting a channel from the sidebar
4. View search results in the main content area

## Development

- Backend: Flask (Python)
- Frontend: React with Vite
- UI: Material-UI
- Containerization: Docker

## License

MIT
