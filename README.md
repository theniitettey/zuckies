# Zuckies - Mentorship Onboarding Platform

A modern, conversational AI-powered onboarding system for software engineering mentorship applications. Built with Next.js, Genkit, Gemini 2.0, and MongoDB.

![Next.js](https://img.shields.io/badge/Next.js-16.0.10-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)
![Genkit](https://img.shields.io/badge/Genkit-1.27-purple?style=flat-square)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-green?style=flat-square&logo=mongodb)

## Overview

This platform provides a chat-based onboarding experience for aspiring software engineers applying to a mentorship program. Instead of traditional forms, applicants engage in a natural conversation with an AI mentor that collects their information, assesses their commitment, and guides them through the application process.

## Features

### Conversational AI Onboarding

- Natural, streaming conversation powered by Gemini 2.0 Flash Exp
- AI personality modeled after a friendly Ghanaian tech mentor
- Smart tool calling for data persistence and state management
- Live typing effect with server-sent events (SSE)
- Meme integration via Giphy for a fun, engaging experience

### Premium UI/UX

- iOS 26-inspired liquid glass aesthetic
- iMessage-style chat bubbles with smooth animations
- Real-time streaming responses (typewriter effect)
- Phase-based progress indicator
- Celebration effects (confetti + sound) on completion
- Mobile-responsive design

### Session Management

- MongoDB persistence for all application data
- Email-based user identification
- Secret phrase verification for returning users (SHA-256 hashed)
- Resume previous sessions or start fresh

### Reliability

- Retry functionality with exponential backoff
- Idempotent message handling
- Dynamic input types (email, phone, URL, text)
- Automatic tool execution with Genkit

## Tech Stack

- **Framework**: Next.js 16.0.10 (App Router)
- **Language**: TypeScript 5
- **AI**: Genkit 1.27.0 with Google AI (Gemini 2.0 Flash Exp)
- **Database**: MongoDB with Mongoose ODM
- **Styling**: Tailwind CSS 4, Framer Motion

## Setup

### Prerequisites

- Node.js 18+ and npm
- MongoDB (local or MongoDB Atlas)
- Google AI API Key (for Gemini)
- Giphy API Key (for meme search)

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/theniitettey/zuckies.git
cd zuckies
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**

Copy the example env file:

```bash
cp .env.example .env.local
```

Edit `.env.local` and add your API keys:

```env
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/mentorship_onboarding

# Google AI (Gemini) API Key
# Get your key from: https://aistudio.google.com/app/apikey
GOOGLE_GENAI_API_KEY=your_google_ai_api_key_here

# Giphy API Key (for meme/GIF search)
# Get your key from: https://developers.giphy.com/
GIPHY_API_KEY=your_giphy_api_key_here
```

**Getting API Keys:**

- **Google AI (Gemini)**: Visit [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) to create a free API key
- **Giphy**: Sign up at [https://developers.giphy.com/](https://developers.giphy.com/) for a free API key

4. **Start MongoDB** (if running locally)

```bash
mongod
```

Or use MongoDB Atlas connection string in `MONGODB_URI`.

5. **Run the development server**

```bash
npm run dev
```

6. **Open your browser**

Navigate to [http://localhost:3000](http://localhost:3000)

- **UI Components**: shadcn/ui
- **Effects**: canvas-confetti

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB instance (local or Atlas)
- Groq API key
- Giphy API key (optional, for memes)

### Environment Variables

Create a `.env.local` file in the root directory:

```env
MONGODB_URI=mongodb+srv://your-connection-string
GROQ_API_KEY=your-groq-api-key
NEXT_PUBLIC_GIPHY_API_KEY=your-giphy-api-key
```

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

### Build for Production

```bash
npm run build
npm start
```

## Application Flow

The onboarding process collects information in the following order:

1. **Email** - Primary identifier for the applicant
2. **Secret Phrase** - For secure session recovery
3. **Name** - Applicant's full name
4. **WhatsApp** - Contact number for communication
5. **GitHub** - Profile URL for portfolio review
6. **Interests** - Areas of focus in software engineering
7. **Experience** - Current skill level and background
8. **Goals** - Career aspirations
9. **Availability** - Time commitment for mentorship
10. **Questions** - Any questions for the mentor

## Project Structure

```
src/
├── app/
│   ├── api/chat/route.ts    # AI chat endpoint with tools
│   ├── globals.css          # iOS 26 liquid glass styles
│   ├── layout.tsx           # SEO metadata
│   └── page.tsx             # Main page
├── components/
│   ├── chat-interface.tsx   # Main chat UI
│   ├── chat-message.tsx     # Message bubbles
│   ├── landing-page.tsx     # Hero section
│   └── ui/                  # shadcn components
├── lib/
│   ├── models/session.ts    # Mongoose session model
│   ├── mongodb.ts           # Database connection
│   └── utils.ts             # Utilities
└── hooks/                   # Custom React hooks
```

## AI Tools

The AI uses three tools to manage the onboarding flow:

- **save_and_continue** - Saves applicant responses and advances to the next phase
- **verify_secret_phrase** - Verifies returning user's secret phrase
- **complete_onboarding** - Finalizes the application

## Security

- Secret phrases are hashed using SHA-256 before storage
- Email addresses are normalized to lowercase
- Sparse unique index on email for data integrity
- Returning users must verify their secret phrase

## Deployment

Deploy to Vercel, Railway, or any platform supporting Next.js:

```bash
# Vercel
vercel deploy

# Docker
docker build -t mentorship-platform .
docker run -p 3000:3000 mentorship-platform
```

## License

MIT

---

Built with ❤️ for aspiring software engineers
