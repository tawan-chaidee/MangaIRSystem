# Manga IR System

A full-text manga search application built around Elasticsearch. The project includes a manga-data scraper, an indexing pipeline, a REST API, and a TypeScript web client.

## Highlights

- Scrapes and prepares manga metadata for indexing
- Uses custom Elasticsearch indexing and stemming behavior
- Supports collection- and description-based search
- Separates the scraper, backend API, and frontend application
- TypeScript application code with an npm/pnpm workspace setup

## Architecture

```text
MangaIRSystem/
├── Tools/      Data scraping and Elasticsearch ingestion
├── backend/    Search API
├── frontend/   TypeScript web client
└── elasticsearch.yml
```

## Run locally

### 1. Install dependencies

```bash
git clone https://github.com/tawan-chaidee/MangaIRSystem.git
cd MangaIRSystem
npm install
```

### 2. Start Elasticsearch

Install Elasticsearch and use **elasticsearch.yml** as a configuration reference.

### 3. Create the local environment file

```bash
cp .env.example .env
```

Update `ELASTICSEARCH_URL` in the local `.env` file if your Elasticsearch instance is not running at `http://localhost:9200`.

### 4. Scrape and index the data

```bash
npm run tool:scraper
npm run tool:db
```

### 5. Start the backend

```bash
npm run server
```

### 6. Start the frontend

In another terminal:

```bash
npm run client
```

## Project context

Built collaboratively as an Information Retrieval course project. The repository history retains the implementation work of [@tawan-chaidee](https://github.com/tawan-chaidee) and [@pastelite](https://github.com/pastelite).
