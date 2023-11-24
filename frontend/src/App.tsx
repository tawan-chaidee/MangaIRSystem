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
      {/* {
        JSON.stringify(searchResults)
      } */}
      {/* <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p> */}
    </>
  )
}

export default App
