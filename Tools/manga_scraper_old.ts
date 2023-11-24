import puppeteer, { Browser } from "puppeteer";
import fs from "fs";
import * as csv from "fast-csv";
import https from "https";
import path from "path"
import dotenv from "dotenv"
dotenv.config({path: path.resolve("../.env")})
import chalk from "chalk";

const MAX_CONCURRENT_TASKS = 1; //GOING TOO FAST
const START_INDEX = 0;
const DATA_SIZE = 100;
const DELAY = 0; // Delay for each manga in milisecond
const WANTED_GENRE = 'Romance';
const JSON_FILE_PATH = 'manga_data.json';

// EventEmitter.defaultMaxListeners = MAX_CONCURRENT_TASKS;
process.setMaxListeners(0);
const csvData = fs.createReadStream('./manga_dataset.csv');
const results: any[] = [];

csv.parseStream(csvData, { headers: true })
  .on('data', (data: { [x: string]: any }) => {
    // Remove non-Manga entries
    if (data['Type'] !== 'Manga')
      return;

    // convert Members and Score to number
    let { Members, Score, ...rest } = data;

    results.push({
      Members: parseIntImproved(Members),
      Score: parseFloatImproved(Score),
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

async function runInParallel(tasks: (() => Promise<any>)[], concurrency: number) {
  const results: any[] = [];
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

async function scrapeMangaData(browser: Browser, url: string, title: string, index: number) {
  try {
    let page = await browser.newPage();
    page.setDefaultNavigationTimeout(0);

    await page.goto(url);
    await page.exposeFunction('notEmpty', notEmpty);
    await page.exposeFunction('parseIntImproved', parseIntImproved);
    await page.exposeFunction('parseFloatImproved', parseFloatImproved);
    page.on('console', (msg) => 
      console.log(chalk.gray(`[Browser] ${msg.text()}`))
    );

    // rate limit detector
    if (await page.$('.g-recaptcha') != null) {
      console.error('Rate limit detected, current index:', index);
      return null;
    }

    const genres = await page.$$eval('span[itemprop="genre"]', (elements) => {
      return elements
        .map((element) => element?.textContent?.trim())
        .filter(notEmpty)
      // .filter();
    });

    // ignore if not wanted genre
    if (!genres.includes(WANTED_GENRE)) {
      console.log(chalk.yellow(index + ': ' + title + ' skipped'));
      await page.close();
      return null;
    }

    let description = await page.$eval('span[itemprop="description"]',
      (element) => element?.textContent?.trim()
    );

    let background = await page.$eval('.rightside > table tr:nth-of-type(1) h2:nth-of-type(2)',
      (elements) => {
        // next sibling
        let pointer = elements.nextSibling;
        let array = []
        while (pointer) {
          // if pointer is text node
          if (pointer instanceof Text) {
            let text = pointer?.textContent?.trim();
            if (text != '') {
              array.push(text);
            }
          }

          // if pointer is Element
          if (pointer instanceof HTMLElement) {
            if (pointer.tagName == 'I') {
              array.push("'" + pointer.textContent?.trim() + "' ");
            } else if (pointer.tagName == 'BR') {
              array.push('\n');
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
      let text = await element.evaluate((el) => el.textContent, element);
      text && alternativeTitle.push(text.trim());
    }

    let authors = await page.$$eval('.information.studio.author a', (elements) => elements.map((element) => element?.textContent?.trim()).filter(notEmpty));
    let score = await page.$eval('.score-label', (element) => parseFloatImproved(element.textContent));
    let members = await page.$eval('.numbers.members', (element) => parseIntImproved(element.textContent));

    // download image
    let imageUrl = await page.$eval('.leftside img', (element: { src: any; }) => element.src)
    let imageLocation = process.env.MANGA_IMAGES_PATH + '/' + index + '.jpg';
    let imageFile = fs.createWriteStream(imageLocation);

    if (!fs.existsSync(imageLocation)) {

      fs.mkdir(process.env.MANGA_IMAGES_PATH, { recursive: true }, (err: any) => {
        if (err) {
          console.error('Error creating image folder:', err);
        }
      });

      https.get(imageUrl, (response: { pipe: (arg0: any) => void; }) => {
        response.pipe(imageFile)

        imageFile.on('finish', () => {
          imageFile.close();
        });
      }).on('error', (err: any) => {
        console.error('Error downloading image for', title, ':', err);
        fs.unlink(imageLocation, (err: any) => { });
      });
    }

    // Get characters from another pages
    page.close()
    page = await browser.newPage();
    page.setDefaultNavigationTimeout(0);
    await page.goto(url + '/characters');
    await page.exposeFunction('notEmpty', notEmpty);
    await page.exposeFunction('parseIntImproved', parseIntImproved);
    await page.exposeFunction('parseFloatImproved', parseFloatImproved);

    let characters = await page.$$eval('#manga-character-container > table', (elements) => {
      return elements.map((element) => {
        let spaceIt = Array.from(element.querySelectorAll('.spaceit_pad'));

        if (spaceIt.length < 3) {
          console.log('Error parsing characters');
          return null;
        }

        let name = spaceIt[0]?.textContent?.trim();
        let role = spaceIt[1]?.textContent?.trim();
        let match = spaceIt[2]?.textContent?.match(/\d+/);
        let popularity = match ? parseInt(match[0]) : 0;

        if (name == undefined || role == undefined) {
          return null;
        }

        // ignore unpopular characters
        // if you can't even surpass 100 popularity
        // I don't think computation time is worth it

        if (popularity < 100) {
          return null;
        }

        return { name, role, popularity };
      }).filter((e) => e != null).sort((a, b) => b!.popularity - a!.popularity);
    })

    // const newManga = new Manga(index, title, alternativeTitle, authors, description, background, genres, characters, members, score);
    const newManga = {
      id: index,
      title,
      alternativeTitle,
      authors,
      description,
      background,
      genres,
      characters,
      members,
      score,
      url,
    };
    // console.log(newManga)
    console.log(chalk.green(index + ': ' + title + ' finished'));
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

function writeJsonFile(filePath: string, data: any) {
  const jsonString = JSON.stringify(data, null, 2);

  fs.mkdir(process.env.MANGA_DATA_PATH, { recursive: true }, (err: any) => {
    if (err) {
      console.error('Error creating JSON folder:', err);
    }
  });

  filePath = filePath.replace(/[\?%*:|"<>]/g, '-');
  fs.writeFile(filePath, jsonString, { flag: "w", encoding: "utf-8" }, (err: any) => {
    if (err) {
      console.error('Error writing JSON file:', err);
    } else {
      // console.log('JSON file has been written successfully:', filePath);
    }
  });
}

function parseIntImproved(string?: string | null) {
  // console.log("parseInt Input", string)
  if (string == undefined) {
    return 0;
  }

  let match = string.match(/(\d|,)+/);
  if (match == null) {
    return 0;
  }

  return Number.parseInt(match[0].replace(/,/g, ''));
}

function parseFloatImproved(string?: string | null) {
  if (string == undefined) {
    return 0;
  }

  let match = string.match(/(\d|,|.)+/);
  if (match == null) {
    return 0;
  }

  return Number.parseFloat(match[0].replace(/,/g, ''));
}

function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
  return value != null && value != undefined;
}