import Elastic from "@elastic/elasticsearch"
import fs from "fs"
import path from "path"
import dotenv from "dotenv"
dotenv.config({ path: path.resolve("../.env") })
// import 'dotenv/config'

const mangaDataPath = path.resolve(process.env.MANGA_DATA_PATH)

const client = new Elastic.Client({
  node: process.env.ELASTICSEARCH_URL,
})

const index = "test-index"

async function main() {
  // clean index if it already exists
  const indexExists = await client.indices.exists({ index })
  if (indexExists) {
    await client.indices.delete({ index })
    console.log("Index already exists: deleted")
  }

  // create index
  await client.indices.create({
    index,
    settings: {
      analysis: {
        analyzer: {
          custom_analyzer: {
            type: "custom",
            tokenizer: "custom_edge_ngram",
            filter: ["lowercase", "asciifolding", "cjk_width", "cjk_bigram"],
          },
        },
        tokenizer: {
          custom_edge_ngram: {
            type: "edge_ngram",
            min_gram: 1,
            max_gram: 20,
            token_chars: ["letter", "digit"],
          },
        },
      }
    },
    mappings: {
      properties: {
        title: {
          type: "text",
          analyzer: "custom_analyzer",
          search_analyzer: "standard",
        },
        alternativeTitle: {
          type: "text",
          analyzer: "custom_analyzer",
          search_analyzer: "standard",
          fields: {
            // for japanese titles
            // standard: {
            //   type: "text",
            //   analyzer: "standard",
            // }
          }
        },
        authors: {
          type: "text",
          analyzer: "custom_analyzer",
          search_analyzer: "standard",
        },
        description: {
          type: "text",
          analyzer: "custom_analyzer",
          search_analyzer: "standard",
        },
        background: {
          type: "text",
          analyzer: "custom_analyzer",
          search_analyzer: "standard",
        },
        genres: {
          type: "text",
          analyzer: "custom_analyzer",
          search_analyzer: "standard",
        },
        members: {
          type: "integer",
        },
        score: {
          type: "float",
        },
      }
    }
  })
  console.log("Index created")

  // settings
  // await client.indices.putSettings({

  // })

  // read data from folder
  fs.readdir(mangaDataPath, async (err, files) => {
    console.log("Reading files from", mangaDataPath)
    if (err) {
      console.log(err)
      return
    }

    for (const file of files) {
      console.log("Adding", file)
      const data = JSON.parse(fs.readFileSync(mangaDataPath + `/${file}`, "utf-8"))
      await client.index({
        index,
        document: data,
        id: data.id,
      })
    }
  })
}

main().then(() => console.log("Finished")).catch()


const addToDb = async (id: string, data: any) => {
  await client.index({
    index,
    id,
    body: data,
  })
}


