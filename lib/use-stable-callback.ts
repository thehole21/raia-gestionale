'use client';
import {useLayoutEffect,useRef,useCallback} from 'react';
// Stable identity for memoized registers; events always use the last committed state.
export function useStableCallback<T extends (...args:any[])=>any>(callback:T):T{
 const latest=useRef(callback);
 useLayoutEffect(()=>{latest.current=callback;});
 return useCallback(((...args:Parameters<T>)=>latest.current(...args)) as T,[]);
}
