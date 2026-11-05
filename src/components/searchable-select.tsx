'use client';
import {Children,isValidElement,useState,type ReactNode,type SelectHTMLAttributes} from 'react';
const text=(node:ReactNode):string=>Children.toArray(node).map(n=>isValidElement<{children?:ReactNode}>(n)?text(n.props.children):String(n)).join(' ');
export function SearchableSelect({children,...props}:SelectHTMLAttributes<HTMLSelectElement>){
 const [query,setQuery]=useState('');const options=Children.toArray(children);const long=options.length>6;
 const visible=options.filter(n=>!query||!isValidElement<{value?:string;children?:ReactNode}>(n)||String(n.props.value??text(n.props.children))===String(props.value)||text(n.props.children).toLocaleLowerCase('it').includes(query.toLocaleLowerCase('it'))||n.props.value==='');
 return <span className="searchable-select">{long&&<input className="picker-search" type="search" autoComplete="off" data-lpignore="true" data-1p-ignore="true" placeholder="Cerca…" aria-label={'Cerca opzioni '+(props['aria-label']||'')} value={query} disabled={props.disabled} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')e.preventDefault();}}/>}<select {...props}>{visible}</select></span>;
}
