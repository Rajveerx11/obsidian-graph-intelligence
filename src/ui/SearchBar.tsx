import { Search } from 'lucide-react';
import type { SearchBarProps } from './types';

export function SearchBar({ value, onChange, placeholder = 'Query your vault...' }: SearchBarProps) {
  return (
    <div className="ogi-search">
      <div className="ogi-search-icon">
        <Search />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="ogi-search-input"
      />
    </div>
  );
}
