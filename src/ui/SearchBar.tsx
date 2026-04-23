import { Search } from 'lucide-react';
import type { SearchBarProps } from './types';

export function SearchBar({ value, onChange, placeholder = 'Query your vault...' }: SearchBarProps) {
  return (
    <div className="relative group">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="h-4 w-4 text-obs-muted group-focus-within:text-obs-primary transition-colors duration-200" />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-obs-panel border border-obs-border text-obs-text placeholder-obs-muted text-sm rounded-2xl py-2.5 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-obs-primary focus:border-obs-primary shadow-sm shadow-black/10 transition-all duration-200"
      />
    </div>
  );
}
