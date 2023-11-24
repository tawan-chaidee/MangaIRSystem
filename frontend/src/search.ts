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
  url: string
}

export type MangaSearchHitsResponse = {
  _index: string
  _id: string
  _score: number
  _source: MangaSearchResult
}

const backendUrl = "http://localhost:3000"

export async function searchElastic(query: string) {
  // Cant use client, need to use fetch
  let response = await fetch(`${backendUrl}/search?q=${query}`)

  if (!response.ok) {
    throw new Error(`Search failed: ${response.statusText}`)
  } else {
    let json = await response.json()
    return json as MangaSearchHitsResponse[]
  }
}