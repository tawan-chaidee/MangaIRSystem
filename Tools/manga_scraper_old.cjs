const puppeteer = require('puppeteer');
const fs = require('fs');
const csv = require('fast-csv');
const EventEmitter = require('events');
const https = require('https');
const dotenv = require('dotenv');
dotenv.config();

const MAX_CONCURRENT_TASKS = 1; //GOING TOO FAST
const START_INDEX = 0;
const DATA_SIZE = 1;
const DELAY = 0; //Delay for each manga in milisecond
const WANTED_GENRE = 'Fantasy';
const JSON_FILE_PATH = 'manga_data.json';
// const JSON_FOLDER = './manga_data/';
// const IMAGE_FOLDER = './manga_images/';

class Manga {
    constructor(id, title, alternativeTitle, authors, description, background, genres, characters, members, score) {
        this.id = id;
        this.title = title;
        this.alternativeTitle = alternativeTitle
        this.authors = authors;
        this.members = members;
        this.score = score;
        this.description = description;
        this.background = background;
        this.genres = genres;
        this.characters = characters;
    }
}

// EventEmitter.defaultMaxListeners = MAX_CONCURRENT_TASKS;
process.setMaxListeners(0);
const csvData = fs.createReadStream('./manga_dataset.csv');
const results = [];

csv.parseStream(csvData, { headers: true })
    .on('data', (data) => {
        // Remove non-Manga entries
        if (data['Type'] !== 'Manga')
            return;

        // convert Members and Score to number
        let { Members, Score, ...rest } = data;

        results.push({
            Members: parseInt(Members),
            Score: parseFloat(Score),
            ...rest
        });
    })
    .on('end', async () => {
        // Sort by Members
        results.sort((a, b) => b.Members - a.Members).map((entry, index) => entry['index'] = index);
        console.log(results)

        const browser = await puppeteer.launch({ headless: true });
        const scrapeTasks = results.slice(START_INDEX, START_INDEX + DATA_SIZE).map((entry) => {
            let index = entry['index'];
            const title = entry['Title'];
            const url = entry['page_url'];
            return () => scrapeMangaData(browser, url, title, index);
        });

        const mangaDataArray = await runInParallel(scrapeTasks, MAX_CONCURRENT_TASKS);

        // Write scraped data to JSON file
        writeJsonFile(JSON_FILE_PATH, mangaDataArray);

        console.log('Scraped data has been written to:', JSON_FILE_PATH);
        console.log('Total manga scraped:', mangaDataArray.length);

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

async function scrapeMangaData(browser, url, title, index) {
    try {
        const page = await browser.newPage();
        page.setDefaultNavigationTimeout(0);

        await page.goto(url);

        // rate limit detector
        if (await page.$('.g-recaptcha') != null) {
            console.error('Rate limit detected, current index:', index);
            return null;
        }

        const genres = await page.$$eval('span[itemprop="genre"]', elements => {
            return elements.map(element => element.textContent.trim());
        });

        // ignore if not wanted genre
        if (!genres.includes(WANTED_GENRE)) {
            console.log(index + ': ' + title + ' skipped');
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
                    array.push("'" + pointer.textContent.trim() + "' ");
                    // if element is br => add new line
                } else if (pointer.tagName == 'BR') {
                    array.push('\n');
                    // if element is text node => add it directly
                } else if (pointer.nodeType == 3) {
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

        let alternativeTitleElements = await page.$x("//h2[.='Alternative Titles']/following::div[@class='spaceit_pad' and following::h2[.='Information']]/text()");
        let alternativeTitle = [];
        for (let element of alternativeTitleElements) {
            let text = await element.evaluate(el => el.textContent, element);
            alternativeTitle.push(text.trim());
        }

        let authors = await page.$$eval('.information.studio.author a', elements => elements.map(element => element.textContent.trim()));
        let score = await page.$eval('.score-label', element => parseFloat(element.textContent.trim()));
        let members = await page.$eval('.numbers.members', element => parseInt(element.textContent.trim().match(/\d+/)[0] || 0));

        // download image
        let imageUrl = await page.$eval('.leftside img', element => element.src)
        let imageLocation = process.env.MANGA_IMAGES_PATH + '/' + index + '.jpg';
        let imageFile = fs.createWriteStream(imageLocation);

        if (!fs.existsSync(imageLocation)) {

            fs.mkdir(process.env.MANGA_IMAGES_PATH, { recursive: true }, (err) => {
                if (err) {
                    console.error('Error creating image folder:', err);
                }
            });

            https.get(imageUrl, (response) => {
                response.pipe(imageFile)

                imageFile.on('finish', () => {
                    imageFile.close();
                });
            }).on('error', err => {
                console.error('Error downloading image for', title, ':', err);
                fs.unlink(imageLocation, (err) => { });
            });
        }

        // Get characters
        await page.goto(url + '/characters');

        let characters = await page.$$eval('#manga-character-container > table', elements => {
            return elements.map(element => {
                let spaceIt = Array.from(element.querySelectorAll('.spaceit_pad'));

                if (spaceIt.length < 3) {
                    return null;
                }

                let name = spaceIt[0]?.textContent.trim();
                let role = spaceIt[1]?.textContent.trim();
                let match = spaceIt[2]?.textContent.trim().match(/\d+/) || 0;
                let popularity = match ? parseInt(match[0]) : 0;

                // ignore unpopular characters
                // if you can't even surpass 100 popularity
                // I don't think computation time is worth it
                if (popularity < 100) {
                    return null;
                }

                return { name, role, popularity };
            })
        })
        characters = characters.filter(character => character != null).sort((a, b) => b.popularity - a.popularity);

        const newManga = new Manga(index, title, alternativeTitle, authors, description, background, genres, characters, members, score);
        console.log(index + ': ' + title + ' finished');
        // index++;

        // Add delay to prevent being identify as bot
        await new Promise(resolve => setTimeout(resolve, DELAY));
        // Close the page after scraping data
        await page.close();

        // save current progress
        // writeJsonFile('./manga_data/'+index+'.json', newManga);
        writeJsonFile(`${process.env.MANGA_DATA_PATH}/${index}-${title}.json`, newManga);

        return newManga;
    } catch (error) {
        console.error('Error during scraping for', title, ':', error);
        return null;
    }
}

function writeJsonFile(filePath, data) {
    const jsonString = JSON.stringify(data, null, 2);

    fs.mkdir(process.env.MANGA_DATA_PATH, { recursive: true }, (err) => {
        if (err) {
            console.error('Error creating JSON folder:', err);
        }
    });

    filePath = filePath.replace(/[\?%*:|"<>]/g, '-');
    fs.writeFile(filePath, jsonString, { flag: "w", encoding: "utf-8" }, (err) => {
        if (err) {
            console.error('Error writing JSON file:', err);
        } else {
            // console.log('JSON file has been written successfully:', filePath);
        }
    });
}

function parseInt(string) {
    return Number.parseInt(string.match(/(\d|,)+/)[0].replace(/,/g, ''));
}

function parseFloat(string) {
    return Number.parseFloat(string.match(/(\d|,|.)+/)[0].replace(/,/g, ''));
}