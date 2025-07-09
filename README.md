# Active listening agent

*Automatically synced with your [v0.dev](https://v0.dev) deployments*

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/neilsethi-hotmailcoms-projects/v0-emir)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.dev-black?style=for-the-badge)](https://v0.dev/chat/projects/ju9EpFZMtL9)

## Overview

This repository will stay in sync with your deployed chats on [v0.dev](https://v0.dev).
Any changes you make to your deployed app will be automatically pushed to this repository from [v0.dev](https://v0.dev).

## Deployment

Your project is live at:

**[https://vercel.com/neilsethi-hotmailcoms-projects/v0-emir](https://vercel.com/neilsethi-hotmailcoms-projects/v0-emir)**

## Build your app

Continue building your app on:

**[https://v0.dev/chat/projects/ju9EpFZMtL9](https://v0.dev/chat/projects/ju9EpFZMtL9)**

## How It Works

1. Create and modify your project using [v0.dev](https://v0.dev)
2. Deploy your chats from the v0 interface
3. Changes are automatically pushed to this repository
4. Vercel deploys the latest version from this repository

## Milestone 2: Anonymous User Tracking & Reflection History

### Features
- Each user is assigned a unique anonymous ID (UUID) stored in localStorage.
- Reflections (transcript, summary, emotion, DSP) are saved to Supabase per user.
- Reflection history is loaded from Supabase and shown in the UI.
- No authentication required; user data is private to their browser/device.

### QA/Test Checklist
- [ ] Record and save a reflection; it appears in history.
- [ ] Refresh: history persists for the same user.
- [ ] Multiple reflections are saved and shown in order.
- [ ] Open in incognito or another browser: history is empty (new user).
- [ ] Open in two tabs: history is consistent.
- [ ] Clear browser storage: new user is created.
- [ ] Try with no audio, silence, or noise: app handles gracefully.
- [ ] Simulate Supabase/network failure: app shows error, does not crash.
- [ ] Large/long reflection: app processes and saves without error.
- [ ] Data corruption in DB: app does not crash, handles missing/invalid fields.

**Note:** Some cases (user ID across browsers/devices, storage clearing, etc.) require testing in a deployed (production) environment, not just locally.

## Environment Variables

Below are all environment variables required for this project, with their purpose and visibility:

| Variable Name                  | Public/Private | Purpose                                                      |
|------------------------------- |:-------------:|--------------------------------------------------------------|
| NEXT_PUBLIC_SUPABASE_URL       | Public        | Supabase project URL for browser (frontend)                  |
| NEXT_PUBLIC_SUPABASE_ANON_KEY  | Public        | Supabase anon key for browser (frontend)                     |
| SUPABASE_URL                   | Private       | Supabase project URL for server/API routes                   |
| SUPABASE_SERVICE_ROLE_KEY      | Private       | Supabase service role key for server/API routes              |
| OPENAI_API_KEY                 | Private       | OpenAI API key for LLM summarization (server-side only)      |
| ANTHROPIC_API_KEY              | Private       | Anthropic Claude API key for LLM summarization (optional)    |
| GOOGLE_API_KEY                 | Private       | Google API key for Gemini, Speech-to-Text, TTS (server-side) |
| HUGGINGFACE_API_KEY            | Private       | HuggingFace API key for emotion analysis (server-side)       |
| ELEVENLABS_API_KEY             | Private       | ElevenLabs API key for TTS (server-side)                     |
| HUME_API_KEY                   | Private       | Hume.ai API key for TTS (server-side, optional)              |
| NEXT_PUBLIC_ADMIN_SECRET       | Public        | Optional: Admin secret for browser admin features            |

**Public variables** (those prefixed with `NEXT_PUBLIC_`) are exposed to the browser and must not contain sensitive information. All other variables are private and only available to server-side code (API routes, server functions).

**Note:** Vercel and Next.js automatically determine public/private status based on the variable name prefix. No extra configuration is needed—just use the correct naming convention.

## Git Merge Summary (for PR/commit)

**Title:** Milestone 2 QA: Anonymous User Tracking & Reflection History

**Description:**
- Implements and documents Milestone 2: anonymous user tracking, Supabase reflection storage, and history UI.
- Adds a comprehensive QA checklist for use and edge cases, including those requiring production testing (e.g., user ID persistence across browsers/devices).
- Prepares the codebase for settings page hardening and LLM fallback in future milestones.