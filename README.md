# Project Oversight

A multiplayer, decision-making game powered by AI where players assume roles on a futuristic government council, voting on absurd crises that affect shared resources.

## Features

- 🎮 Multiplayer (4 players/session)
- 🤖 AI-generated scenarios, secret incentives, and narrative outcomes
- 🗳️ Real-time voting with countdown timers
- 📊 Dynamic resource dashboard
- 🔒 Secret incentives & elimination mechanics
- 🔥 End conditions: 1 player remains, 10 rounds, or resource depletion

## Tech Stack

- Frontend: React + Tailwind CSS
- Backend: Python FastAPI + WebSockets
- AI: OpenAI GPT-4 API
- State Management: Redis
- Database: PostgreSQL
- Containerization: Docker

## Prerequisites

- Docker and Docker Compose
- OpenAI API Key
- Node.js 18+ (for local development)
- Python 3.10+ (for local development)

## Setup

1. Clone the repository:

```bash
git clone https://github.com/yourusername/project-oversight.git
cd project-oversight
```

2. Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

3. Update the `.env` file with your OpenAI API key and other configuration.

4. Start the application using Docker Compose:

```bash
docker-compose up --build
```

The application will be available at:

- Frontend: http://localhost:3000
- Backend API: ${import.meta.env.VITE_BACKEND_URL}
- API Documentation: ${import.meta.env.VITE_BACKEND_URL}/docs

## Local Development

### Frontend

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Backend

```bash
# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
cd backend
pip install -r requirements.txt

# Start development server
uvicorn main:app --reload
```

## Project Structure

```
project-oversight/
├── frontend/           # React frontend application
│   ├── src/
│   │   ├── components/
│   │   ├── features/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── services/
│   │   └── styles/
│   └── package.json
├── backend/           # FastAPI backend application
│   ├── main.py
│   ├── game/
│   │   └── state.py
│   ├── ai/
│   │   └── scenario_generator.py
│   └── requirements.txt
├── docker-compose.yml
└── README.md
```

## API Documentation

The API documentation is available at ${import.meta.env.VITE_BACKEND_URL}/docs when running the backend server.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
