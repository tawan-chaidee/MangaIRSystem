import Elastic from "@elastic/elasticsearch"
import fs from "fs"
import path from "path"
import dotenv from "dotenv"
dotenv.config({path: path.resolve("../.env")})
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
  await client.indices.create({ index })
  console.log("Index created")

  // read data from folder
  fs.readdir(mangaDataPath, async (err, files) => {
    console.log("Reading files from", mangaDataPath)
    if (err) {
      console.log(err)
      return
    }

    for (const file of files) {
      console.log("Adding", file)
      const data = JSON.parse(fs.readFileSync(mangaDataPath+`/${file}`, "utf-8"))
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


