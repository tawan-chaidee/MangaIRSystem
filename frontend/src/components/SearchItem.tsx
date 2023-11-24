import { MangaSearchHitsResponse } from '../search'
import './SearchItem.style.css'

interface SearchItemProps extends React.HTMLAttributes<HTMLDivElement> {
  item: MangaSearchHitsResponse
}

export default function SearchItem({ item, className, ...props }: SearchItemProps) {

  return (
    <div className={`search-item ${className}`}   {...props}>
      <div className="score">
        {item._score}
      </div>
      <div className='top-info'>
        <h2>{item._source.title}</h2>
        <div>({item._source.alternativeTitle.join(', ')})</div>
      </div>
      
      <p>{item._source.description}</p>
    </div>
  );
}