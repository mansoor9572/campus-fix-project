"use client"

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from "react"
import { Languages } from "lucide-react"
import { translateText } from "@/lib/i18n/translate"
import { LANGUAGE_COOKIE, type Language } from "@/lib/i18n/config"
const TRANSLATED_ATTRIBUTES = ["placeholder", "aria-label", "title", "alt"] as const
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE", "PRE", "NOSCRIPT"])

type LanguageContextValue = { language: Language; setLanguage: (language: Language) => void }
const LanguageContext = createContext<LanguageContextValue | null>(null)

// useLayoutEffect warns during server rendering; this runs only in the browser.
const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect

/*
 * The app's copy is written in English inside each component. Instead of
 * rewriting every component, this layer swaps rendered English text (and
 * placeholder/aria-label/title/alt attributes) for Indonesian in the DOM and
 * keeps the English original so switching back restores it exactly. State,
 * form values and data sent to the server are never touched.
 */
class DomTranslator {
  private textOriginals = new WeakMap<Text, { original: string; shown: string }>()
  private attrOriginals = new WeakMap<Element, Map<string, { original: string; shown: string }>>()
  private observer: MutationObserver | null = null
  private language: Language = "en"

  start(language: Language) {
    this.language = language
    this.translateTree(document.body)
    // Streamed sections can finish hydrating after this provider; sweep once more when they settle.
    window.setTimeout(() => this.translateTree(document.body), 300)
    if (this.observer) return
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") this.translateText(mutation.target as Text)
        else if (mutation.type === "attributes") this.translateAttribute(mutation.target as Element, mutation.attributeName!)
        else mutation.addedNodes.forEach((node) => this.translateTree(node))
      }
    })
    this.observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...TRANSLATED_ATTRIBUTES],
    })
  }

  stop() {
    this.observer?.disconnect()
    this.observer = null
  }

  private skipped(element: Element | null) {
    for (let current = element; current; current = current.parentElement) {
      if (SKIP_TAGS.has(current.tagName) || current.hasAttribute("data-no-translate") || (current as HTMLElement).isContentEditable) return true
    }
    return false
  }

  private translateTree(root: Node) {
    if (root.nodeType === Node.TEXT_NODE) return this.translateText(root as Text)
    if (root.nodeType !== Node.ELEMENT_NODE) return
    const element = root as Element
    if (this.skipped(element)) return
    for (const attribute of TRANSLATED_ATTRIBUTES) this.translateAttribute(element, attribute)
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => node.nodeType === Node.ELEMENT_NODE && (SKIP_TAGS.has((node as Element).tagName) || (node as Element).hasAttribute("data-no-translate"))
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
    })
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE) this.translateText(node as Text)
      else for (const attribute of TRANSLATED_ATTRIBUTES) this.translateAttribute(node as Element, attribute)
    }
  }

  private translateText(node: Text) {
    const current = node.nodeValue ?? ""
    const record = this.textOriginals.get(node)
    // React (or the app) wrote new text since we last translated: treat it as the new English source.
    const original = record && record.shown === current ? record.original : current
    if (!/[A-Za-z]/.test(original) || this.skipped(node.parentElement)) return
    const next = this.language === "id" ? translateText(original) : original
    this.textOriginals.set(node, { original, shown: next })
    if (next !== current) node.nodeValue = next
  }

  private translateAttribute(element: Element, attribute: string) {
    const current = element.getAttribute(attribute)
    if (current === null) return
    let records = this.attrOriginals.get(element)
    const record = records?.get(attribute)
    const original = record && record.shown === current ? record.original : current
    if (!/[A-Za-z]/.test(original)) return
    const next = this.language === "id" ? translateText(original) : original
    if (!records) this.attrOriginals.set(element, (records = new Map()))
    records.set(attribute, { original, shown: next })
    if (next !== current) element.setAttribute(attribute, next)
  }
}

export function LanguageProvider({ initialLanguage, children }: { initialLanguage: Language; children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(initialLanguage)
  // Hide the page until the first Indonesian pass so English does not flash on load.
  const [revealed, setRevealed] = useState(initialLanguage === "en")
  const [translator] = useState(() => new DomTranslator())

  useBrowserLayoutEffect(() => {
    translator.start(language)
    document.documentElement.lang = language
    setRevealed(true)
  }, [language, translator])

  useEffect(() => () => translator.stop(), [translator])

  const setLanguage = useCallback((next: Language) => {
    document.cookie = `${LANGUAGE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
    setLanguageState(next)
  }, [])

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {revealed ? null : <style>{"body{visibility:hidden}"}</style>}
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error("useLanguage must be used within LanguageProvider")
  return context
}

export function LanguageSwitcher({ floating = false }: { floating?: boolean }) {
  const { language, setLanguage } = useLanguage()
  return (
    <div className={floating ? "language-switcher language-switcher-floating" : "language-switcher"} role="group" aria-label="Language" data-no-translate>
      <Languages aria-hidden="true" />
      {(["en", "id"] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={language === option}
          title={option === "en" ? "English" : "Bahasa Indonesia"}
          onClick={() => setLanguage(option)}
        >
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
