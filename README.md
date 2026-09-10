# Iowa From Above

Explore Iowa from a new perspective.

**Iowa From Above** is an interactive 3D educational experience where players pilot a drone across Iowa, discover landmarks, complete missions, and learn about the history, culture, architecture, and geography behind each location.

The project was built for the Congressional App Challenge.

## How It Works

Players explore Iowa through a photorealistic 3D environment using a controllable drone.

Throughout the experience, players can:

- Fly through a 3D recreation of Iowa
- Travel between different parts of the state through portals
- Discover 12 major Iowa landmarks
- Watch cinematic introductions to each location
- Learn facts and history from an interactive guide
- Complete questions and challenges
- Earn flight boosts and other rewards
- Explore additional information about each landmark
- Ask the AI guide questions about what they are exploring

The goal is to make learning about Iowa feel more like exploring a world than reading through a traditional website.

## AI Tour Guide

The in-game guide can answer questions about landmarks while the player explores.

The browser does **not** communicate directly with the AI provider.

Instead:

```text
Player
  ↓
Iowa From Above
  ↓
Next.js API Route
  ↓
Groq API
  ↓
AI Guide Response
```

This keeps the API key on the server rather than exposing it in the browser.

## Environment Variables

To use the AI guide locally, create a file named:

```text
.env.local
```

in the root of the project.

Add your Groq API key:

```env
GROQ_API_KEY=your_groq_api_key_here
```

Do **not** commit `.env.local` to Git.

The `.gitignore` file should include:

```gitignore
.env*
```

This allows the application to access the API key locally while keeping the actual key out of the GitHub repository.

## Running Locally

Install the dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

## Built With

- Next.js
- TypeScript
- CesiumJS
- Google Maps Platform
- Photorealistic 3D Tiles
- Groq API
- GPT-OSS
- Custom 3D models and animations

## Project Structure

```text
Iowa From Above
│
├── 3D World
│   ├── Photorealistic 3D Tiles
│   ├── Drone
│   ├── Portals
│   └── Landmarks
│
├── Exploration
│   ├── Missions
│   ├── Questions
│   ├── Flight Boosts
│   └── Discoveries
│
├── Guide
│   ├── Landmark Information
│   └── AI Questions
│
└── API
    └── Groq
```

## API Keys

API keys and other private credentials are intentionally excluded from this repository.

If you clone this project, you will need to provide your own API credentials through environment variables before features that depend on those services will work.

## Congressional App Challenge

Iowa From Above was created as a submission for the 2026 Congressional App Challenge.

The project explores how interactive 3D environments can be used to make local history and geography more engaging by allowing users to actually explore the places they are learning about.

## Author

**Mustafa Hameed**

<img width="3020" height="1650" alt="image" src="https://github.com/user-attachments/assets/b368f1c2-2912-446d-958f-8887082952a7" />
