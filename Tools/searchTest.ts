import Elastic from "@elastic/elasticsearch"
import path from "path"
import dotenv from "dotenv"
dotenv.config({path: path.resolve("../.env")})

const client = new Elastic.Client({
  node: process.env.ELASTICSEARCH_URL,
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
                  fields: ["title^2", "alternativeTitle^1.5", "authors^1.5", "description^1.2", "background^0.5", "genres^1.5"],
                }
              }            ]
          }
        },
        functions: [
          { script_score: { script: "Math.log(doc['members'].value) * 2" }},
          { script_score: { script: "Math.log(doc['score'].value)" }}
        ],
        score_mode: "multiply",
        boost_mode: "sum",
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