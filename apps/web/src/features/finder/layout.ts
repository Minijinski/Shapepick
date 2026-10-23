import { useEffect, useState } from 'react'

// A layout under test: the journey as a column at the left of the console and the console's
// buttons in a small module of their own at the right ("side", the default), or the journey bar
// under the console ("bar", as before). `?layout=bar` or `?layout=side` on any finder page
// switches, remembered in this browser. Below 80rem the page keeps the bar whatever the choice
// (styles.css).

export type FinderLayout = 'side' | 'bar'

const KEY = 'choose-a-device:layout'

/** The layout this browser asked for: "side" while rendering on the server and hydrating. */
export function useFinderLayout(): FinderLayout {
  const [layout, setLayout] = useState<FinderLayout>('side')
  useEffect(() => {
    try {
      const asked = new URLSearchParams(window.location.search).get('layout')
      if (asked === 'side' || asked === 'bar') localStorage.setItem(KEY, asked)
      setLayout(localStorage.getItem(KEY) === 'bar' ? 'bar' : 'side')
    } catch {}
  }, [])
  return layout
}
