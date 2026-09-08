# Návod: od obrazovky přes data ke containerům

Cíl: rozdělit obrazovku na nejmenší ostrovy, které se překreslují spolu. Ostrov = container + jeho views až k dalšímu containeru. Pořadí je **views → data → místa → containery**: nejdřív co je vidět, pak co se mění, pak kde se to potkává, a teprve z toho vyjdou containery. Příklad: board z fixture.

## 1. Views: jedna velká view a co se opakuje

Nakresli obrazovku jako **jednu view**: jen markup, žádné hooky, žádný store, žádné id.

```
Board
├─ filtr (input)
├─ sloupec ×n: nadpis, počet, seznam karet
│  └─ karta ×n: titulek, zvýraznění, kdo, hotovo
├─ statistika: hotovo / celkem
└─ detail vybrané karty: titulek, kdo
```

Jediné, co v tomhle kroku vyřízneš, je **co se opakuje**: karta a detail mají stejný rámeček → `Card`, vstupní pole → `Input`. To jde do sdílené vrstvy (`src/components` nebo `<modul>/shared/`) a velká view to importuje. Nic jiného zatím neděl. Seznam, položka, layout, to všechno je pořád jedna view.

## 2. Data: strom stavu a co se mění spolu

Napiš strom stavu (typ `RootState`, tak jak ho kreslí panel `state` v toolu):

```
board
├─ filter: string
├─ selectedTaskId: string | null
├─ columns.ids: string[]
├─ columns.byId[id].{ title, taskIds }
├─ tasks.byId[id].{ title, assigneeId, done }
└─ users.byId[id].{ name }
```

Změnu definují **akce**, ne obrazovka. Ke každému reduceru napiš, která pole zapisuje a jak často:

| akce | zapisuje | jak často |
|---|---|---|
| `setFilter` | `filter` | každá klávesa |
| `selectTask` | `selectedTaskId` | klik |
| `toggleDone` | `tasks.byId[id].done` | klik |
| `assignTask` | `tasks.byId[id].assigneeId` | zřídka |
| `renameTask` | `tasks.byId[id].title` | zřídka |
| `moveTask` | `columns.byId[id].taskIds` | občas |

Pole, která zapisují stejné akce, tvoří **datový ostrov**. Pole, která nikdy nezapisuje stejná akce, se mění nezávisle.

**Podmínka, bez které ostrovy neexistují: reducery dělají malé změny, ne výměnu objektů.** `t.done = !t.done` mění jedno pole. `state.tasks.byId[id] = { ...task, done }` vymění celý task a s ním „změní“ title, assigneeId i done najednou: tři ostrovy se slijí do jednoho. Totéž `return { ...state, filter }`. Immer dovolí psát jemně; API odpověď se zapisuje po polích. Tool to hlásí jako `coarse-write`, lint jako `store-no-object-swap` a `store-no-state-replace`.

## 3. Místa: kde ostrov dopadá na obrazovku

Každý ostrov → kde se jeho pole zobrazují. Odvozené hodnoty (počet, statistika) jsou pole taky.

| ostrov | dopadá do |
|---|---|
| `setFilter` | filtr; a přes viditelné karty i do sloupců |
| `selectTask` | zvýraznění karty (u dvou karet), detail |
| `toggleDone` | „hotovo“ na kartě, statistika |
| `renameTask` | titulek karty, titulek v detailu |
| `assignTask` + `renameUser` | „kdo“ na kartě i v detailu |
| `moveTask` (+ `setFilter`) | seznam karet ve sloupci |
| `renameColumn` | nadpis sloupce |

**Místo** = souvislý kus view, kam ostrov dopadá. Jeden ostrov může mít víc míst (kdo: karta i detail), jedno místo může nést víc ostrovů (karta: titulek i zvýraznění). Dvojice **ostrov × místo** je to, co budeme stavět.

## 4. Containery: jeden na ostrov × místo, a řez velké view

**Pravidlo řezu: jeden container čte jednu změnovou skupinu na jednom místě.** Když dva ostrovy dopadají do úplně stejné view (titulek + zvýraznění v kartě), může je nést jeden container. Když by container četl ostrovy, které dopadají do různých views, rozděl ho: cena je `jak často × kolik views se překreslí zbytečně`. Nedělit kvůli jednomu stringu.

| container | ostrov | místo |
|---|---|---|
| `BoardContainer` | `columns.ids` (skoro nikdy) | kostra |
| `FilterContainer` | `setFilter` | filtr |
| `ColumnContainer(id)` | `renameColumn` + členství (memo selektor nad `taskIds` + `filter`) | sloupec |
| `TaskContainer(id)` | `renameTask` + `selectTask` (stejná view) | karta |
| `AssigneeContainer(taskId)` | `assignTask` + `renameUser` (stejná view) | „kdo“ na kartě i v detailu |
| `TaskActionsContainer(taskId)` | `toggleDone` | „hotovo“ na kartě |
| `StatsContainer` | odvozené z `tasks` (memo selektor) | statistika |
| `SelectedTaskContainer` | `selectTask` + `renameTask` | detail |

Tři containery na jedné kartě nejsou přehnané: tři ostrovy dopadají na tři různá místa karty.

**Teď se řeže velká view**, a to přesně v místech containerů. V každém takovém bodě view končí a začíná **slot**: `Board` dostane sloty `toolbar`, `columns`, `sidebar`; `Column` slot `children`; `Task` sloty `assignee`, `actions`. Co zbylo z velké view, jsou views jednotlivých containerů: `Board`, `Filter`, `Column`, `Task`, `Assignee`, `Actions`, `Stats`, `SelectedTask`. Jiný důvod k řezu než container a reuse neexistuje. Seznam a položka jsou dva ostrovy, tedy dva containery; layout je zbytek se sloty; „čitelnost“ je vkus.

**Co container posílá svému view:**
- **hodnoty** svého ostrova (`title: string`, `selected: boolean`), nikdy celé entity,
- **handlery** svého ostrova (`onSelect`), vytvořené v containeru,
- pro každý jiný ostrov na stejném místě **element child containeru do slotu** (`assignee={<AssigneeContainer taskId={id}/>}`).

Data nikdy neprocházejí view, aby se dostala k containeru níž. Když view potřebuje `taskId` jen proto, aby ho podala dál, je řez o úroveň výš, než má být.

**Hooky podle ostrovů**: každý ostrov má úzký hook adresovaný id: `useTaskTitle(id)`, `useIsTaskSelected(id)`, `useTaskDone(id)`, `useUser(id)`; odvozené přes memoizovaný selektor (`useVisibleTaskIds(columnId)`, `useStats()`). Container sahá jen na hooky svého modulu, nikdy na store.

## 5. Ověř v toolu

- `design: data → containers`: strom stavu obarvený podle ostrovů, sloupec ostrovů s akcemi, dnešní containery s tečkami ostrovů, views jako místa. Sidebar „Proposed containers: island × place“: u každé dvojice dnešní container / chybí / rozdělit. Cíl: žádné „missing“, žádné červené.
- `state · containers · views`: teal čára z pole jen do containerů, které ho zobrazují; utlumená (pokrytá širší subscription) jsou podezřelá.
- **trace** na pole nebo akci: oranžová vlna zasáhne jen ostrovy, které to zobrazují. `toggleDone` → 1 ostrov (+ statistika přes memo selektor).
- **islands**: kolik ostrovů se dotkne jedna akce; tolik, kolik míst se opravdu změní, ani o jeden víc.
- lint: `view-no-container-import`, `view-no-state`, `container-one-view`, `container-no-store-import`, `store-no-object-swap`.

## Typické chyby, které postup odhalí

- **Široká subscription „pro jistotu“** (`useBoard()`): jeden container čte všechny ostrovy, jeden obří ostrov. Before: 14 překreslení na změnu titulku.
- **Entita místo hodnot** (`task: Task` do view): view dostává i pole, která nezobrazuje, a překreslí se s nimi; tool ukazuje, že změna titulku „teče“ i do Assignee.
- **Pass-through id**: view zná `taskId` jen kvůli potomkovi. Řez je o úroveň výš, než má být.
- **Seznam a položka v jednom containeru**: členství a obsah položek jsou dva ostrovy; každá klávesa ve filtru překreslí všechny karty.
- **Odvozená hodnota bez memo selektoru**: Stats se překreslí při každé změně `tasks`, i když výsledek zůstal.
- **Hrubý zápis** (`coarse-write`): reducer vymění celý objekt nebo slice; ostrovy v datech se slijí. V akicolors: `gradientsSlice` swapuje celý gradient.

## Co k tomu umí tool

Krok 2 čte staticky: reducer → zapisované cesty (`state.filter = …`, alias `const t = state.tasks.byId[id]; t.done = …`, mutátory, `delete`, `return {…}`), stejně jako čte selektory. Krok 3 odvozuje z datového toku: subscription → props → views, i přes odvozené hodnoty a hook → hook. Pohled `design: data → containers` pak ukáže kroky 2 až 4 najednou a sekce **Actions: what re-renders** a **Islands** dají čísla pro krok 5.
