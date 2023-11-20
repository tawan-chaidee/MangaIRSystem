const puppeteer = require('puppeteer');
const fs = require('fs');
const csv = require('fast-csv');
const EventEmitter = require('events');

const MAX_CONCURRENT_TASKS = 1; //GOING TOO FAST
const DATA_SIZE = 17810;
const DELAY = 2000; //Delay for each manga in milisecond
let index = 1;


class Manga {
    constructor(title, description, background, genres, characters) {
        this.title = title;
        this.description = description;
        this.background = background;
        this.genres = genres;
        this.characters = characters;
    }
}

EventEmitter.defaultMaxListeners = MAX_CONCURRENT_TASKS;
const csvData = fs.createReadStream('WebScrapeTool/manga_dataset.csv');
const results = [];

csv.parseStream(csvData, { headers: true })
    .on('data', (data) => {
        results.push(data);
    })
    .on('end', async () => {
        const browser = await puppeteer.launch({ headless: true });
        const scrapeTasks = results.slice(0, DATA_SIZE).map((entry) => {
            const title = entry['Title'];
            const url = entry['page_url'];
            return () => scrapeMangaData(browser, url, title);
        });

        const mangaDataArray = await runInParallel(scrapeTasks, MAX_CONCURRENT_TASKS);

        const jsonFilePath = 'manga_data.json';
        writeJsonFile(jsonFilePath, mangaDataArray);

        console.log('Scraped data has been written to:', jsonFilePath);

        // Close the browser after all tasks are completed
        await browser.close();
    });

async function runInParallel(tasks, concurrency) {
    const results = [];
    const queue = [...tasks];

    async function runNextTask() {
        const task = queue.shift();
        if (task) {
            const result = await task();
            if (result != null) {
                results.push(result);
            }
            await runNextTask();
        }
    }

    const executing = Array.from({ length: concurrency }, () => runNextTask());
    await Promise.all(executing);
    return results;
}

async function scrapeMangaData(browser, url, title) {
    try {
        const page = await browser.newPage();
        page.setDefaultNavigationTimeout(0);

        await page.goto(url);

        const description = await page.evaluate(() => {
            const descriptionElement = document.querySelector('span[itemprop="description"]');
            return descriptionElement ? descriptionElement.textContent.trim() : '';
        });

        const genres = await page.evaluate(() => {
            const genreElements = document.querySelectorAll('.spaceit_pad [itemprop="genre"]');
            const genres = [];

            genreElements.forEach((element) => {
                genres.push(element.textContent.trim());
            });

            return genres;
        });

        let background = '';
        const elements = await page.$$('#content > table > tbody > tr > td:nth-child(2) > div.rightside.js-scrollfix-bottom-rel > table');
        for (const element of elements) {
            const textContent = await page.evaluate(el => el.textContent, element);
            const match = textContent.match(/EditBackground([\s\S]*?)(?:\n\s*\n|$)/);

            if (match) {
                background = match[1].trim();
                break;
            }
        }

        await page.goto(url+'/characters');
        // Get characters directly from the main manga page
        const characters = await page.$$eval('h3.h3_character_name', elements => {
            return elements.map(element => element.textContent.trim());
        });

        const newManga = new Manga(title, description, background, genres, characters);
        console.log(index + ': ' + title + ' finished');
        index++;


        // Add delay to prevent being indentify as bot
        await new Promise(resolve => setTimeout(resolve, DELAY));
        // Close the page after scraping data
        await page.close();

        return newManga;
    } catch (error) {
        console.error('Error during scraping for', title, ':', error);
        return null;
    }
}

function writeJsonFile(filePath, data) {
    const jsonString = JSON.stringify(data, null, 2);

    fs.writeFile(filePath, jsonString, 'utf-8', (err) => {
        if (err) {
            console.error('Error writing JSON file:', err);
        } else {
            console.log('JSON file has been written successfully:', filePath);
        }
    });
}
