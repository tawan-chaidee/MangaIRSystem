# Manga IR System
This is the code for Information Retrieval Project

## Setup guide
1. Git clone this repo and install all dependencies
```bash
git clone tawan-chaidee/MangaIRSystem
cd MangaIRSystem
npm install
```
2. Download and install ElasticSearch. The config file we used is in elasticsearch.yml
3. Change .env file so ELASTICSEARCH_URL is correct
4. Go to cd tools and start scraping data
```bash
npm run tool:scraper
```
5. Add to database
```bash
npm run tool:db
```
6. open new terminal and run backend
```bash
npm run server
```
7. Start client
```bash
npm run client
```
8. Enjoy