import { ChangeEvent, useEffect, useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { searchElastic } from './search'
import { MangaSearchHitsResponse } from './search'
import SearchItem from './components/SearchItem'

function App() {
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<MangaSearchHitsResponse[]>([])

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
  }

  useEffect(() => {
    searchElastic(search).then((res) => {
      setSearchResults(res)
    })

  },[search])

  return (
    <>
      <input type="text" value={search} onChange={handleChange} />
      <h1>Result</h1>
      {
        searchResults.map((result) => {
          return <SearchItem item={result} />
        })
      }
    </>
  )
}

export default App
