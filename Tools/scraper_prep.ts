import puppeteer from "puppeteer";
import fs from "fs";
import * as csv from "fast-csv";
import scrapeMangaData from "./scraper_func.js";

// const url = "https://anilist.co/search/manga?genres=Romance&genres=Fantasy&format=MANGA&country%20of%20origin=JP"
const apiUrl = "https://graphql.anilist.co"
const delay = 1000
const startIndex = 1
const endIndex = 100

async function main() {

  // Fetch top 50 romance manga from anilist
  let anilistList = await fetchManga(endIndex, "Romance")

  let mangaList: any[] = []
  fs.createReadStream("./manga_dataset.csv")
    .pipe(csv.parse({ headers: true }))
    .on("data", (data: any) => {
      data["TitleLower"] = data.Title.toLowerCase().trim().replace(/[^a-zA-Z0-9]/g, "")
      if (data.Type.trim() == "Manga" && parseInt(data.Members) > 10000)
        mangaList.push(data)
    })
    .on("end", async () => {
      let toBeScraped: any[] = []

      anilistList.forEach((anime: string) => {
        let formattedAnime = anime.toLowerCase().trim().replace(/[^a-zA-Z0-9]/g, "")

        let bestMatch = mangaList.reduce((prev, curr) => {
          let prevDistance = levenshteinDistance(prev.TitleLower, formattedAnime)
          let currDistance = levenshteinDistance(curr.TitleLower, formattedAnime)
          return prevDistance < currDistance ? prev : curr
        })

        toBeScraped.push(bestMatch)
      })

      // Start scraping
      let browser = await puppeteer.launch({ headless: true })
      toBeScraped = toBeScraped.map((entry, index) => {
        entry["in"] = index
        return entry
      })
      toBeScraped = toBeScraped.slice(startIndex,endIndex)
      let scrapeTasks = toBeScraped.map((entry) => {
        let index = entry["in"]
        let title = entry.Title
        let url = entry.page_url
        let malId = url.match(/\/(\d+)\//)[1]

        return () => scrapeMangaData(browser, url, title, index, malId)
      })

      // No parallel because of rate limiting
      for (let i = 0; i < scrapeTasks.length; i++) {
        await scrapeTasks[i]()
        await new Promise(resolve => setTimeout(resolve, delay))
      }

      // Close the browser after all tasks are completed
      await browser.close()
    })
}

function levenshteinDistance(str1: string, str2: string) {
  const m = str1.length;
  const n = str2.length;

  // Create a 2D array to store the distances
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  // Initialize the first row and column
  for (let i = 0; i <= m; i++) {
    dp[i][0] = i;
  }

  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  // Fill in the rest of the array
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  // The bottom-right cell contains the Levenshtein distance
  return dp[m][n];
}

async function fetchManga(number: number, genre: string) {
  let reqNum = Math.ceil(number / 50)
  let mangaList: string[] = []

  for (let i = 1; i <= reqNum; i++) {
    let query = `
    query($page: Int, $perPage: Int, $genre: String) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
        }
        media(
          format: MANGA
          type: MANGA
          sort: POPULARITY_DESC
          genre: $genre
          countryOfOrigin: "JP"
        ) {
          id
          title {
            romaji
          }
        }
      }
    }
    `
    let variables = {
      page: i,
      perPage: 50,
      genre: genre
    }

    let response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query, variables })
    })

    let json = await response.json()
    let mangaName: string[] = json.data.Page.media.map((manga: any) => {
      return manga.title.romaji
    })
    mangaList = mangaList.concat(mangaName)
  }

  return mangaList
}

main().then(() => {
  console.log("Done")
})
