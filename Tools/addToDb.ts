import Elastic from "@elastic/elasticsearch"
import fs from "fs"
import path from "path"

const appRoot = path.resolve(__dirname, "../../")

const client = new Elastic.Client({
  node: "http://localhost:9200",
})

const index = "test-index"

async function main() {
  // // create index if not exists
  // const indexExists = await client.indices.exists({ index })
  // if (!indexExists) {
  //   await client.indices.create({ index })
  //   console.log("Index created")
  // } else {
  //   console.log("Index already exists, skipping creation")
  // }

  // clean index if exists
  const indexExists = await client.indices.exists({ index })
  if (indexExists) {
    await client.indices.delete({ index })
    console.log("Index deleted")
  }

  // create index
  await client.indices.create({ index })
  console.log("Index created")

  // read data from folder
  fs.readdir(appRoot + "/manga_data", async (err, files) => {
    if (err) {
      console.log(err)
      return
    }

    for (const file of files) {
      const data = JSON.parse(fs.readFileSync(appRoot + `/manga_data/${file}`, "utf-8"))
      await client.index({
        index,
        document: data,
      })
    }
  })
}

main().then(() => console.log("Finished"))


const addToDb = async (id: string, data: any) => {
  await client.index({
    index,
    id,
    body: data,
  })
}


