# Deployment Guide

## Local deployment

1. Install Python 3.11 or newer.
2. Run `python -m pip install -r requirements.txt`.
3. Optionally run `python -m flask --app backend.app seed`.
4. Start with `python run.py`.

## Public URLs after deploy

The app has two separate panels:

- Admin panel: `https://your-domain/admin`
- User panel: `https://your-domain/user`

## Render

This project includes `render.yaml`, so Render can create the web service from the repository.

1. Push this folder to a GitHub repository.
2. In Render, choose **New > Blueprint** and select the repository.
3. Render reads `render.yaml` and creates one Python web service.
4. After deploy, open `/admin` and `/user` on the Render URL.

The included Render settings are:

- Build command: `pip install -r requirements.txt`
- Start command: `gunicorn backend.app:app`
- Health check: `/api/health`
- Persistent SQLite database path: `/var/data/equipment_tracker.db`
- Persistent disk mount path: `/var/data`

## Manual Render or Railway setup

- Runtime: Python 3
- Build command: `pip install -r requirements.txt`
- Start command: `gunicorn backend.app:app`
- Environment variable: `TRACKER_DB=/var/data/equipment_tracker.db` when a persistent disk is attached
- Environment variable: `SECRET_KEY=<long-random-production-secret>`

For production, attach persistent storage before real users start using the app. SQLite is suitable for the prototype; migrate to PostgreSQL for multiple concurrent workers or larger workloads.

## Validation checklist

- `/api/health` returns HTTP 200.
- Create, list, inspect, detail, dashboard, and CSV endpoints work.
- The database path is writable and persistent.
- Mobile and desktop layouts render correctly.
- Error responses do not expose stack traces.
- User and admin login sessions work over HTTPS.
