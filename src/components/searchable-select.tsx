'use client';
import type {SelectHTMLAttributes} from 'react';
// Native selects retain the complete list, scrolling and keyboard type-ahead.
export function SearchableSelect({children,...props}:SelectHTMLAttributes<HTMLSelectElement>){
 return <span className="searchable-select"><select {...props}>{children}</select></span>;
}
