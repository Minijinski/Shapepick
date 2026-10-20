import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import { Flip } from 'gsap/Flip'
import { SplitText } from 'gsap/SplitText'

// GSAP and its plugins are registered once, in the browser only. Every component imports gsap from
// here so the registration always runs first.

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP, Flip, SplitText, CustomEase)
  CustomEase.create('signal', 'M0,0 C0.22,1 0.36,1 1,1')
  CustomEase.create('signal.in', 'M0,0 C0.55,0 0.75,0.2 1,1')
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export { Flip, gsap, SplitText, useGSAP }
