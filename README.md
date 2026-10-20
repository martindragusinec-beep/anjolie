# Anjolie - homepage (frontend)

Statické HTML, CSS a vanilla JS podle Figmy (soubor VK4UfLudV8qyOyHewqSI6d, stránka Web, rámy Desktop 1440 a Mobile 430). Bez buildu a bez závislostí, stačí otevřít `index.html`.

## Struktura

- `index.html` - homepage, sémantické sekce, ARIA, české nezlomitelné mezery
- `css/tokens.css` - tokeny vygenerované z Figma proměnných (názvy = Code syntax WEB), doplněné o komponentové tokeny, motion a gutter
- `css/styles.css` - komponenty a sekce, mobile first, breakpointy 768 / 1024 / 1200 / 1280
- `js/app.js` - veškerá interakce, jeden IIFE bez knihoven
- `img/` - optimalizované fotky (cca 1,6 MB celkem), názvy podle obsahu

Fonty: Newsreader (nadpisy) a Figtree (text) z Google Fonts. Na produkci doporučuji self-hosting přes woff2 a `font-display: swap`.

## Co je dynamické (napojit na Shoptet / backend)

- **Košík** (`initCart`): položky, počet v hlavičce (při 0 se odznak skryje), mezisoučet, řádek Množstevní sleva, ukazatel slevy (1 ks / 2-4 ks / 5+ ks), tlačítko "Přidat N. kus", odebrání ikonou koše s hláškou "Vrátit" (6 s), prázdný stav, cross-sell na desktopu. Sleva se počítá po produktech: 2 ks -10 %, od 5 ks -15 %. Data jsou v `<script id="anj-data" type="application/json">`, na produkci nahradit API košíku.
- **Hledání** (`initSearch`): na desktopu rozbalovací panel 560 px, pod 1200 px celoobrazovkový overlay. Filtruje lokální index s ignorováním diakritiky, šipky + Enter, rychlé volby, prázdný stav. Na produkci napojit na našeptávač Shoptetu.
- **Záložky Doporučujeme** (Nejprodávanější / Novinky / Akce): ARIA tabs, šipky, Home/End. Obsah karuselů plnit z feedu.
- **Newsletter**: validace při odeslání, `aria-invalid`, potvrzení. Napojit na e-mailový nástroj (double opt-in).
- **Oznamovací lišta**: na desktopu tři zprávy vedle sebe, na mobilu rotace po 5 s (zastaví se při `prefers-reduced-motion`).

## Chování podle šířky

- Mobil do 767 px: patička v akordeonech, karusely se swipem a ukazatelem posunu.
- Tablet 768-1199 px: mobilní hlavička s hamburgerem, obsah ve dvou až třech sloupcích, karusely se šipkami od 1024 px.
- Desktop od 1200 px: mega menu Obchod (hover intent 150/200 ms, Esc zavírá), účet v hlavičce.

## Přístupnost

Fokus 2 px s odsazením 2 px, dotykové plochy min. 44 px, dialogy (menu, košík, hledání) s focus trapem a návratem fokusu, `prefers-reduced-motion` vypíná animace a rotaci lišty.

## K ověření před nasazením

- URL recenzí na Heurece: `https://obchody.heureka.cz/anjolie-cz/recenze/` (neověřeno)
- URL produktů a kategorií odpovídají struktuře anjolie.cz, zkontrolovat proti aktuálnímu webu
- Ceny, hodnocení a sklad v kartách jsou ukázková data z návrhu
- Příspěvky v Co je nového vedou na Instagram, ideálně napojit na feed
