import { MangaSearchHitsResponse } from '../search'
import './SearchItem.style.css'

interface SearchItemProps extends React.HTMLAttributes<HTMLDivElement> {
  item: MangaSearchHitsResponse
}

export default function SearchItem({ item, className, ...props }: SearchItemProps) {

  return (
    <a className='no-format' href={item._source.url}>
    <div className={`search-item ${className}`}   {...props}>
      <img src={import.meta.env.VITE_BACKEND_URL + '/image/' + item._id + '.jpg'} alt={item._source.title} />
      <div className='right-content'>
        <div className="score">
          {item._score}
        </div>
        <div className='top-info'>
          <h2>{item._source.title}</h2>
          <div>by {item._source.authors.join(' & ')}</div>
        </div>

        {/* <div className='aka'>
          {item._source.alternativeTitle.length >= 0 && <>
            aka. {item._source.alternativeTitle.join(', ')}<br />
          </>
          }
          <b>Score:</b> {item._source.score} <b>Members:</b> {item._source.members}
        </div> */}

        <p className='genres'>
          {item._source.genres.map((genre) => {
            return <span>{genre}</span>
          })}
        </p>
        <p className="description">{item._source.description}</p>
      </div>
    </div>
    </a>
  );
}