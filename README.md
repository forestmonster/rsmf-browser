# Slack RSMF Browser

This is a low-quality Dockerized Flask application that allows browsing and searching through Slack RSMF ([Relativity Short Message Format](https://help.relativity.com/RelativityOne/Content/System_Guides/Relativity_Short_Message_Format/Relativity_short_message_format.htm)) export files. It provides a Slack-like interface with channel navigation and simple search capabilities.

## Features

- Upload and parse Slack RSMF export ZIP files
- Browse messages by time period
- Search through messages and attachments
- View and download attachments
- Responsive UI that sort of looks like Slack's interface

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
3. Access the application at `http://localhost:80` to ensure you're using the Nginx proxy.

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

1. Upload a Slack RSMF export ZIP file using the file upload button
2. Select a time period from the sidebar on the left to view messages
3. Use the search bar to filter messages
4. Click on attachments to view or download them

## Development

- Backend: Flask (Python)
- Frontend: React with Vite
- UI: Material-UI
- Containerization: Docker

## License

MIT
