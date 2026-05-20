# TapTag Docker Guide

This branch provides a Dockerized **web demo** for TapTag.

## What Docker is for on this branch

Use Docker when you want:

- a quick browser-based demo
- fewer local setup steps
- a reproducible tester path

## What Docker is not for here

This Docker setup does **not** try to run:

- Expo Go on a phone from inside the container
- Android emulator inside the container
- iOS simulator inside the container

Those flows are still better with the normal local Expo setup.

## Quick start

```bash
docker compose up --build
```

Then open:

```text
http://localhost:8080
```

## NPM helpers

From the repo root:

```bash
npm run docker:build
npm run docker:run
```

Or with Compose:

```bash
npm run docker:up
npm run docker:down
```

## How it works

1. installs the project dependencies
2. runs `expo export --platform web`
3. serves the static web build from Nginx

## Why this approach

TapTag is an Expo app. For a Dockerized tester flow, the cleanest path is to ship the web build rather than trying to force native mobile tooling into a container.
