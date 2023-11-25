import { ChangeEvent, useEffect, useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import { searchElastic } from '../search'
import { MangaSearchHitsResponse } from '../search'
import SearchItem from './SearchItem'
import './SearchBar.css'
import SearchIcon from '../assets/SearchIcon.svg'

export default function SearchBar() {
    const [search, setSearch] = useState('')
    const [searchResults, setSearchResults] = useState<MangaSearchHitsResponse[]>([])

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value)
    }

    useEffect(() => {
        searchElastic(search).then((res) => {
            const modifiedHits = res.map(hit => ({
                ...hit,
                _source: {
                    ...hit._source,
                    description: hit._source.description.replace('[Written by MAL Rewrite]', ''),
                },
            }));
            setSearchResults(modifiedHits);
        })
    }, [search])

    return (
        <>

            <div className="search-box">
                <h1 className='web-title'>HeartHub</h1>

                <input type="text" value={search} onChange={handleChange} className="search-input" />
                <button className="search-button">
                    <img src={SearchIcon} alt="Search Icon" />

                </button>
            </div>


            <div className="result-box">
                {
                    searchResults.map((result) => {
                        return <SearchItem item={result} />
                    })
                }
            </div>



        </>
    )
}

