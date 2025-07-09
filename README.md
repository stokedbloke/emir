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