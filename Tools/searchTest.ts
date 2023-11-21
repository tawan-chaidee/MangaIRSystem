import Elastic from "@elastic/elasticsearch"
import path from "path"

const appRoot = path.resolve(__dirname, "../../")

const client = new Elastic.Client({
  node: "http://localhost:9200",
})

const index = "test-index"

let query = "Adventure"

client.search({
  index,
  body: {
    query: {
      function_score: {
        query: {
          bool: {
            should: [
              {
                multi_match: {
                  query: query,
                  fields: ["title^3", "author^2", "description^0.5", "background^0.25", "alternativeTitle^2.5", "genres^2"],
                }
              }
            ]
          }
        },
        functions: [
          { script_score: { script: "_score * Math.log(doc['members'].value)" }}
        ],
        score_mode: "multiply"
      },
    },
    size: 25,
  }
}).then((res) => {
  res.hits.hits.forEach((hit) => {
    let source: any = hit._source
    let score = hit._score
    console.log(source.title, score)
  })
})