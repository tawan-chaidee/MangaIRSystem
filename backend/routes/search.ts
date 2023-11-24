import express, { Request } from 'express';
import { MangaSearchResult, client } from '../server.js';
const app = express.Router()

const index = 'test-index'

app.get('/', async (req: Request<{}, {}, {}, { q: string }>, res) => {
  let query = req.query.q || ""

  try {
    let result = await client.search<MangaSearchResult>({
      index,
      query: {
        function_score: {
          query: {
            bool: {
              should: [
                // original search
                {
                  multi_match: {
                    query: query,
                    fields: ["title^6", "alternativeTitle^2", "authors^3"],
                  }
                },
                // wildcard search, contributes less to score
                {
                  query_string: {
                    query: '*' + query + '*',
                    fields: ["title^3", "alternativeTitle^1", "authors^2", "description^1.2", "background^0.5", "genres^1.5"],
                  }
                },
                {
                  nested: {
                    path: "characters",
                    query: {
                      function_score: {
                        query: {
                          match: {
                            "characters.name": {
                              query: query,
                            }
                          }
                        },
                        functions: [
                          { script_score: { script: "Math.log(doc['characters.popularity'].value)" } },
                        ],
                        score_mode: "sum",
                        boost: 0.1,
                      },
                    },
                  }
                },
                {"match_all": {}}, // to make sure that's not empty
              ]
            }
          },
          functions: [
            {
              filter: { match_all: {} },
              script_score: { script: "Math.log(doc['members'].value) * 1.5" }
            },
            {
              filter: { match_all: {} },
              script_score: { script: "Math.log(doc['score'].value)" }
            }
          ],
          score_mode: "multiply",
          boost_mode: "sum",
        },
      },
      size: 25,
    })

    res.send(result.hits.hits)

  } catch (e) {
    console.log(e)
    res.send([])
    return
  }



})

export { app }