export type MangaSearchResult = {
  title: string
  alternativeTitle: string[]
  authors: string[]
  description: string
  background: string
  genres: string[]
  members: number
  score: number
  characters: {
    name: string
    role: string
    popularity: number
  }[]
}

export type MangaSearchHitsResponse = {
  _index: string
  _id: string
  _score: number
  _source: MangaSearchResult
}

const url = "http://localhost:9200"
const index = "test-index"

export async function searchElastic(query: string) {
  // Cant use client, need to use fetch
  let res = await fetch(url + "/" + index + "/_search", {
    method: "POST",
    body: JSON.stringify({
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
                    query: '*'+query+'*',
                    fields: ["title^3", "alternativeTitle^1", "authors^2", "description^1.2", "background^0.5", "genres^1.5"],
                  }
                }]
            }
          },
          functions: [
            { script_score: { script: "Math.log(doc['members'].value) * 1.5" } },
            { script_score: { script: "Math.log(doc['score'].value)" } }
          ],
          score_mode: "multiply",
          boost_mode: "sum",
        },
      },
      size: 25,
    }),
    headers: {
      "Content-Type": "application/json"
    }
  })

  let json = await res.json()
  let hits = json.hits.hits
  return hits as MangaSearchHitsResponse[]

  // let index = "test-index"

  // let res = await client.search({
  //   index,
  //   body: {
  //     query: {
  //       function_score: {
  //         query: {
  //           bool: {
  //             should: [
  //               {
  //                 multi_match: {
  //                   query: query,
  //                   fields: ["title^2", "alternativeTitle^1.5", "authors^1.5", "description^1.2", "background^0.5", "genres^1.5"],
  //                 }
  //               }]
  //           }
  //         },
  //         functions: [
  //           { script_score: { script: "Math.log(doc['members'].value) * 2" } },
  //           { script_score: { script: "Math.log(doc['score'].value)" } }
  //         ],
  //         score_mode: "multiply",
  //         boost_mode: "sum",
  //       },
  //     },
  //     size: 25,
  //   }
  // })

  // return res.hits.hits
}