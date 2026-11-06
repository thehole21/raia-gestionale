'use client';
import { useEffect, useState } from 'react';
import {BookPriceSummary} from './book-configurator';
import { cloud } from '@/lib/supabase';
import { type Quote, type BookSpec, specLabels } from '@/lib/book-spec';
export function SpecSummary({spec}:{spec:BookSpec}) {return <dl className="quote-spec">{Object.entries(specLabels).map(([k,label])=><div key={k}><dt>{label}</dt><dd>{(typeof spec[k as keyof BookSpec]==='boolean'?(spec[k as keyof BookSpec]?'Sì':'No'):String(spec[k as keyof BookSpec]??''))||'—'}</dd></div>)}</dl>;}
export function BookPdf({path,label}:{path:string;label:string}) {
 const [url,setUrl]=useState(''); const [error,setError]=useState('');
 useEffect(()=>{let live=true;let objectUrl=''; setUrl('');setError('');cloud().storage.from('raia-customer-files').download(path).then(({data,error})=>{if(!live)return;if(error){setError('PDF non disponibile. Riprova riaprendo il dettaglio.');return;}objectUrl=URL.createObjectURL(data);setUrl(objectUrl);});return()=>{live=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};},[path]);
 return <section className="portal-pdf"><div><h3>{label}</h3>{url&&<a className="btn btn-small btn-plain" href={url} download={label+'.pdf'}>Scarica PDF</a>}</div>{error?<p role="alert">{error}</p>:url?<iframe title={label} src={url+'#view=FitH'} sandbox="allow-same-origin allow-scripts allow-downloads"/>:<p>Caricamento PDF…</p>}</section>;
}
export function BookRequestDetails({id}:{id:string}) {
 const [quote,setQuote]=useState<Quote|null>(null);const [message,setMessage]=useState('');
 useEffect(()=>{let live=true;setQuote(null);setMessage('');cloud().from('raia_quotes').select('id,spec,book_path,cover_path,order_id,status,created_at').eq('id',id).single().then(({data,error})=>{if(!live)return;if(error)setMessage('Impossibile caricare le specifiche del libro.');else setQuote(data);});return()=>{live=false;};},[id]);
 return <section className="customer-request"><div className="eyebrow">DETTAGLI LIBRO</div>{quote&&<><h3>{quote.spec.title}</h3><SpecSummary spec={quote.spec}/>{quote.spec.pricing&&<BookPriceSummary snapshot={quote.spec.pricing}/>}<BookPdf path={quote.book_path} label="Interno libro"/><BookPdf path={quote.cover_path} label="Copertina"/>{quote.spec.additionalBooks?.map((b,i)=><section key={i}><h3>{b.title}</h3><SpecSummary spec={b}/>{b.bookPath&&<BookPdf path={b.bookPath} label={`Interno ${b.title}`}/ >}{b.coverPath&&<BookPdf path={b.coverPath} label={`Copertina ${b.title}`}/>}</section>)}</>}{message&&<p role="status">{message}</p>}</section>;
}
