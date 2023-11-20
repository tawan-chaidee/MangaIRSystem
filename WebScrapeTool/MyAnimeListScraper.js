const puppeteer = require('puppeteer');
const fs = require('fs');
const csv = require('fast-csv');
const EventEmitter = require('events');

const MAX_CONCURRENT_TASKS = 2; //GOING TOO FAST
const DATA_SIZE = 5;
const DELAY = 2000; //Delay for each manga in milisecond
const WANTED_GENRE = 'Fantasy';


class Manga {
    constructor(title, authors, description, background, genres, characters, members, score) {
        this.title = title;
        this.authors = authors;
        this.members = members;
        this.score = score;
        this.description = description;
        this.background = background;
        this.genres = genres;
        this.characters = characters;
        
    }
}

EventEmitter.defaultMaxListeners = MAX_CONCURRENT_TASKS;
const csvData = fs.createReadStream('./manga_dataset.csv');
const results = [];

csv.parseStream(csvData, { headers: true })
    .on('data', (data) => {
        // Remove non-Manga entries
        if (data['Type'] !== 'Manga')
            return;
        
        // convert Members and Score to number
        let {Members, Score, ...rest} = data;

        results.push({
            Members: Number.parseInt(Members),
            Score: Number.parseFloat(Score),
            ...rest
        });
    })
    .on('end', async () => {
        // Sort by Members
        results.sort((a, b) => b.Members - a.Members);

        const browser = await puppeteer.launch({ headless: true });
        const scrapeTasks = results.slice(0, DATA_SIZE).map((entry) => {
            const title = entry['Title'];
            const url = entry['page_url'];
            return () => scrapeMangaData(browser, url, title);
        });

        const mangaDataArray = await runInParallel(scrapeTasks, MAX_CONCURRENT_TASKS);

        // Write scraped data to JSON file
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

        const genres = await page.$$eval('span[itemprop="genre"]', elements => {
            return elements.map(element => element.textContent.trim());
        });

        // ignore if not wanted genre
        if (!genres.includes(WANTED_GENRE)) {
            console.log(title + 'skipped');
            await page.close();
            return null;
        }

        let description = await page.$eval('span[itemprop="description"]', element => element.textContent.trim());

        let background = await page.$eval('.rightside > table tr:nth-of-type(1) h2:nth-of-type(2)', elements => {
            // next sibling
            let pointer = elements.nextSibling;
            let array = []
            while (pointer) {
                // if element is i => format it
                if (pointer.tagName == 'I') {
                    array.push("'"+pointer.textContent.trim()+"' ");
                // if element is br => add new line
                } else if (pointer.tagName == 'BR') {
                    array.push('\n');
                // if element is text node => add it directly
                } else if (pointer.nodeType == 3 ) {
                    let text = pointer.textContent.trim();
                    if (text != '') {
                        array.push(text);
                    }
                }
                // move to next sibling
                pointer = pointer.nextSibling;
            }
            return array.join('');
        })

        let authors = await page.$$eval('.information.studio.author a', elements => elements.map(element => element.textContent.trim()));
        let score = await page.$eval('.score-label', element => Number.parseFloat(element.textContent.trim()));
        let members = await page.$eval('.numbers.members', element => Number.parseInt(element.textContent.trim().match(/\d+/)[0] || 0));

        // Get characters
        await page.goto(url+'/characters');

        let characters = await page.$$eval('#manga-character-container > table', elements => {
            return elements.map(element => {
                let spaceIt = Array.from(element.querySelectorAll('.spaceit_pad'));

                if (spaceIt.length < 3) {
                    return null;
                }
                
                let name = spaceIt[0]?.textContent.trim();
                let role = spaceIt[1]?.textContent.trim();
                let match = spaceIt[2]?.textContent.trim().match(/\d+/) || 0;
                let popularity = match ? Number.parseInt(match[0]) : 0;

                // ignore unpopular characters
                // if you can't even surpass 100 popularity
                // I don't think computation time is worth it
                if (popularity < 100) {
                    return null;
                }

                return {name, role, popularity};
            })
        })
        characters = characters.filter(character => character != null).sort((a, b) => b.popularity - a.popularity);

        const newManga = new Manga(title, authors, description, background, genres, characters, members, score);
        console.log(title + ' finished');
        // index++;

        // Add delay to prevent being identify as bot
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
