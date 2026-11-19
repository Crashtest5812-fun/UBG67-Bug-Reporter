# Crashtest Support

## Run locally

```bash
npm start
```

Open `http://localhost:4173`.

## Developer portal

Use `CTest5812` or `LStung67` with the credentials configured for the deployment.

Set both credentials before starting the server:

```bash
CTEST5812_PASSWORD="your-password" LSTUNG67_PASSWORD="your-password" npm start
```

Reports are persisted in `data/reports.json`. Keep `data/` private when deploying and use HTTPS plus a real database in production.

## Publish with Render

The repository includes `render.yaml`. In Render:

1. Create a new Blueprint and connect this GitHub repository.
2. Enter the two password environment variables when prompted:
   - `CTEST5812_PASSWORD`
   - `LSTUNG67_PASSWORD`
3. Deploy the service.

Render will provide a public HTTPS URL. GitHub Pages cannot host this app's Node.js API or login sessions.