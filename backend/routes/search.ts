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
                {
                  multi_match: {
                    query: query,
                    fields: ["title^10", "alternativeTitle^6", "authors^6", "genres^6"],
                    // fuzziness: "auto", // Add fuzziness to support misspellings
                  }
                },
                {
                  multi_match: {
                    query: query,
                    fields: ["description^3", "background^1.5"],
                  }
                },
                // wildcard search, contributes less to score
                // {
                //   query_string: {
                //     query: '*' + query + '*',
                //     fields: ["title^4", "alternativeTitle^3", "authors^3", "description^4", "background^3", "genres^4"],
                //   }
                // },
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
                        boost: 2,
                      },
                    },
                  }
                },
                // { "match_all": {} }, // to make sure that's not empty
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