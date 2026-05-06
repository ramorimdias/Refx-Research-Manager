'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, ChevronLeft, Lightbulb, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { APP_GLOBAL_TOUR_STEPS, APP_PAGE_TOURS, type AppGlobalTourStep, type AppTourPlacement, type AppTourStep } from '@/lib/app-tour'
import { translate, type AppLocale, useLocale } from '@/lib/localization'
import { cn } from '@/lib/utils'

type AppTourContextValue = {
  isOpen: boolean
  isGlobalTourRunning: boolean
  startCurrentPageTour: () => void
  startGlobalAppTour: () => void
  closeCurrentPageTour: () => void
  nextTourStep: () => void
  previousTourStep: () => void
  skipCurrentPageTour: () => void
  canStartCurrentPageTour: boolean
  hasCurrentPageTour: boolean
  currentPageTourUnavailableReason: string | null
}

type AppTourProviderProps = {
  children: React.ReactNode
  enabled: boolean
  autoStartGlobalTour?: boolean
  onGlobalTourComplete?: (reason: 'completed' | 'dismissed') => void
}

type SpotlightRect = {
  top: number
  left: number
  width: number
  height: number
}

const TARGET_SELECTOR_PREFIX = '[data-tour-id="'
const TARGET_WAIT_TIMEOUT_MS = 2400
const GLOBAL_TOUR_LOG_PREFIX = '[app-tour]'
const BALLOON_WIDTH = 360
const VIEWPORT_PADDING = 24
const GAP = 18

const APP_TOUR_TRANSLATIONS: Partial<Record<AppLocale, Record<string, string>>> = {
  en: {
    'tour.steps.homeOverview.title': 'Home page',
    'tour.steps.homeOverview.body': 'This is your dashboard. You can jump back into recent work, open favorite content, and get a quick sense of what is happening across your research workspace.',
    'tour.steps.searchOverview.title': 'Search page',
    'tour.steps.searchOverview.body': 'Use search to explore your library with quick queries, grouped logic, and focused filters.',
    'tour.steps.readerOverview.title': 'Reader home',
    'tour.steps.readerOverview.body': 'This page helps you resume reading quickly. You can reopen recent documents and continue from where you left off.',
    'tour.steps.readerViewOverview.title': 'PDF reader',
    'tour.steps.readerViewOverview.body': 'This is the document reading workspace. You can read PDFs, search inside them, add highlights and notes, and move through your material in context.',
    'tour.steps.discoverOverview.title': 'Discover page',
    'tour.steps.discoverOverview.body': 'This page helps you explore a document outward. You can start discovery journeys, follow references and citations, save paths, and inspect connected works visually.',
    'tour.steps.librariesOverview.title': 'Libraries page',
    'tour.steps.librariesOverview.body': 'Libraries organize your research collection. From here you can browse documents, switch views, and manage the contents of the current library.',
    'tour.steps.documentsOverview.title': 'Document details page',
    'tour.steps.documentsOverview.body': 'This page is where you review and edit a document in depth, including metadata, tags, references, and the preview of the file itself.',
    'tour.steps.referencesOverview.title': 'References page',
    'tour.steps.referencesOverview.body': 'Use this workspace to manage references around your own work, review linked sources, and build structured citation outputs.',
    'tour.steps.settingsOverview.title': 'Settings page',
    'tour.steps.settingsOverview.body': 'Settings control how Refx behaves on this device, including appearance, processing defaults, backups, updates, and onboarding tools.',
  },
  'pt-BR': {
    'tour.steps.readerOverview.title': 'Início do leitor',
    'tour.steps.readerOverview.body': 'Esta página ajuda você a retomar a leitura rapidamente. Aqui você pode reabrir documentos recentes e continuar de onde parou.',
    'tour.steps.readerViewOverview.title': 'Leitor de PDF',
    'tour.steps.readerViewOverview.body': 'Este é o espaço de leitura do documento. Aqui você pode ler PDFs, buscar dentro deles, adicionar destaques e notas e navegar pelo material com contexto.',
    'tour.steps.discoverOverview.title': 'Página Discover',
    'tour.steps.discoverOverview.body': 'Esta página ajuda você a explorar um documento para fora. Aqui você pode iniciar jornadas de descoberta, seguir referências e citações, salvar caminhos e inspecionar conexões visualmente.',
    'tour.steps.librariesOverview.title': 'Página de bibliotecas',
    'tour.steps.librariesOverview.body': 'As bibliotecas organizam a sua coleção de pesquisa. Nesta página você pode navegar pelos documentos, trocar a visualização e gerenciar o conteúdo da biblioteca atual.',
    'tour.steps.documentsOverview.title': 'Página de detalhes do documento',
    'tour.steps.documentsOverview.body': 'Aqui você revisa e edita o documento em profundidade, incluindo metadados, tags, referências e a visualização do arquivo.',
    'tour.steps.referencesOverview.title': 'Página de referências',
    'tour.steps.referencesOverview.body': 'Use este espaço para gerenciar referências ligadas aos seus próprios trabalhos, revisar fontes conectadas e montar saídas de citação.',
    'tour.steps.settingsOverview.title': 'Página de configurações',
    'tour.steps.settingsOverview.body': 'As configurações controlam como o Refx funciona neste dispositivo, incluindo aparência, processamento, backups, atualizações e ferramentas de onboarding.',
    'tour.steps.navigatorOverview.title': 'Navegador principal',
    'tour.steps.navigatorOverview.body': 'Este menu à esquerda é o navegador principal do app e dá acesso rápido a cada área importante.',
    'tour.steps.homeOverview.title': 'Tela inicial',
    'tour.steps.homeOverview.body': 'Aqui você encontra suas bibliotecas, atividade recente e documentos abertos recentemente.',
    'tour.steps.searchOverview.title': 'Página de busca',
    'tour.steps.searchOverview.body': 'Use a busca simples para pesquisas rápidas, a busca complexa para lógica em grupos e as opções para refinar os resultados.',
    'tour.steps.librariesToolbar.title': 'Controles da biblioteca',
    'tour.steps.librariesToolbar.body': 'Crie bibliotecas, importe PDFs, registre livros físicos, troque de biblioteca e ajuste a visualização do espaço.',
    'tour.steps.librariesImport.title': 'Importar documentos',
    'tour.steps.librariesImport.body': 'Use este botão para importar documentos PDF para a biblioteca atual.',
    'tour.steps.librariesPhysicalBook.title': 'Adicionar livro físico',
    'tour.steps.librariesPhysicalBook.body': 'Use esta opção para registrar um livro físico e guardar notas mesmo sem arquivo PDF.',
    'tour.steps.librariesViews.title': 'Modos de visualização da biblioteca',
    'tour.steps.librariesViews.body': 'Alterne entre tabela, grade e lista dependendo de como deseja navegar pela biblioteca atual.',
    'tour.steps.librariesList.title': 'Conteúdo da biblioteca',
    'tour.steps.librariesList.body': 'Esta área mostra o conteúdo da biblioteca ativa com ordenação, filtros e ações sobre os documentos.',
    'tour.steps.documentDetailsInformation.title': 'Editar detalhes: informação',
    'tour.steps.documentDetailsInformation.body': 'Aqui você edita as informações principais do documento, incluindo título, autores, ano, estado de leitura e resumo.',
    'tour.steps.documentDetailsTags.title': 'Editar detalhes: tags',
    'tour.steps.documentDetailsTags.body': 'Use a seção de tags para adicionar tags próprias, revisar sugestões e classificar o documento do seu jeito.',
    'tour.steps.documentDetailsReferences.title': 'Editar detalhes: referências',
    'tour.steps.documentDetailsReferences.body': 'A área de referências mostra links de entrada e saída para revisar como este documento se conecta ao resto da biblioteca.',
    'tour.steps.documentDetailsMetadata.title': 'Buscar metadados online',
    'tour.steps.documentDetailsMetadata.body': 'Use esta ação para consultar provedores online e preencher metadados ausentes com informações mais limpas.',
    'tour.steps.commentsOverview.title': 'Comentários do documento',
    'tour.steps.commentsOverview.body': 'Esta página de comentários é onde você escreve o comentário geral do documento usando as notas salvas como apoio.',
    'tour.steps.readerHighlights.title': 'Destaques no leitor',
    'tour.steps.readerHighlights.body': 'No leitor de PDF você pode destacar trechos diretamente na página e trabalhar dentro do documento.',
    'tour.steps.readerNotes.title': 'Notas no leitor',
    'tour.steps.readerNotes.body': 'Adicione notas diretamente no leitor e prenda cada uma ao ponto exato da leitura.',
    'tour.steps.readerSearch.title': 'Busca no leitor',
    'tour.steps.readerSearch.body': 'Use a busca do leitor para encontrar texto dentro do documento e navegar entre as ocorrências.',
    'tour.steps.referencesWork.title': 'Minhas referências',
    'tour.steps.referencesWork.body': 'Você pode adicionar seus trabalhos aqui e gerenciar as referências ligadas a eles.',
    'tour.steps.notesListOverview.title': 'Notas de todos os documentos',
    'tour.steps.notesListOverview.body': 'Esta lista reúne notas de todos os documentos para você revisar tudo em um só lugar antes de editar a nota selecionada.',
    'tour.steps.notesOverview.title': 'Notas',
    'tour.steps.notesOverview.body': 'Aqui você pode gerenciar suas notas e editá-las na hora.',
    'tour.steps.mapsOverview.title': 'Mapas',
    'tour.steps.mapsOverview.body': 'Crie conexões visuais e relacionamentos entre artigos, documentos e seus próprios trabalhos.',
    'tour.steps.metadataOverview.title': 'Metadados',
    'tour.steps.metadataOverview.body': 'Importe metadados da web e gerencie informações ausentes dos documentos da sua biblioteca.',
    'tour.steps.settingsOptions.title': 'Opções de configurações',
    'tour.steps.settingsOptions.body': 'Estas seções agrupam as principais preferências do app, da configuração geral até aparência, processamento, dados e sobre.',
  },
  fr: {
    'tour.steps.readerOverview.title': 'Accueil du lecteur',
    'tour.steps.readerOverview.body': 'Cette page vous aide à reprendre rapidement votre lecture. Vous pouvez rouvrir des documents récents et continuer là où vous vous êtes arrêté.',
    'tour.steps.readerViewOverview.title': 'Lecteur PDF',
    'tour.steps.readerViewOverview.body': 'Ceci est l’espace de lecture du document. Vous pouvez lire des PDF, chercher à l’intérieur, ajouter des surlignages et des notes, et avancer avec plus de contexte.',
    'tour.steps.discoverOverview.title': 'Page Discover',
    'tour.steps.discoverOverview.body': 'Cette page vous aide à explorer un document au-delà de sa lecture directe. Vous pouvez lancer des parcours de découverte, suivre références et citations, enregistrer des chemins et inspecter les connexions visuellement.',
    'tour.steps.librariesOverview.title': 'Page des bibliothèques',
    'tour.steps.librariesOverview.body': 'Les bibliothèques organisent votre collection de recherche. Ici, vous pouvez parcourir les documents, changer l’affichage et gérer le contenu de la bibliothèque active.',
    'tour.steps.documentsOverview.title': 'Page de détail du document',
    'tour.steps.documentsOverview.body': 'Cette page permet de revoir et modifier un document en profondeur, y compris les métadonnées, les tags, les références et l’aperçu du fichier.',
    'tour.steps.referencesOverview.title': 'Page des références',
    'tour.steps.referencesOverview.body': 'Utilisez cet espace pour gérer les références autour de votre propre travail, revoir les sources liées et produire des sorties de citation structurées.',
    'tour.steps.settingsOverview.title': 'Page des réglages',
    'tour.steps.settingsOverview.body': 'Les réglages contrôlent le comportement de Refx sur cet appareil, notamment l’apparence, le traitement, les sauvegardes, les mises à jour et les outils d’onboarding.',
    'tour.steps.navigatorOverview.title': 'Navigateur principal',
    'tour.steps.navigatorOverview.body': 'Ce menu à gauche est le navigateur principal de l’application et donne un accès rapide à chaque zone importante.',
    'tour.steps.homeOverview.title': 'Écran d’accueil',
    'tour.steps.homeOverview.body': 'Vous y trouvez vos bibliothèques, l’activité récente et les documents ouverts récemment.',
    'tour.steps.searchOverview.title': 'Page de recherche',
    'tour.steps.searchOverview.body': 'Utilisez la recherche simple pour aller vite, la recherche complexe pour la logique par groupes et les options pour affiner les résultats.',
    'tour.steps.librariesToolbar.title': 'Contrôles de la bibliothèque',
    'tour.steps.librariesToolbar.body': 'Créez des bibliothèques, importez des PDF, enregistrez des livres papier, changez de bibliothèque et ajustez l’affichage.',
    'tour.steps.librariesImport.title': 'Importer des documents',
    'tour.steps.librariesImport.body': 'Utilisez ce bouton pour importer des documents PDF dans la bibliothèque actuelle.',
    'tour.steps.librariesPhysicalBook.title': 'Ajouter un livre papier',
    'tour.steps.librariesPhysicalBook.body': 'Utilisez cette option pour enregistrer un livre papier et conserver des notes même sans fichier PDF.',
    'tour.steps.librariesViews.title': 'Modes d’affichage de la bibliothèque',
    'tour.steps.librariesViews.body': 'Basculez entre tableau, grille et liste selon la façon dont vous voulez parcourir la bibliothèque actuelle.',
    'tour.steps.librariesList.title': 'Contenu de la bibliothèque',
    'tour.steps.librariesList.body': 'Cette zone affiche le contenu de la bibliothèque active avec tri, filtres et actions sur les documents.',
    'tour.steps.documentDetailsInformation.title': 'Modifier les détails : informations',
    'tour.steps.documentDetailsInformation.body': 'Cette page vous permet de modifier les informations principales du document, dont le titre, les auteurs, l’année, le statut de lecture et le résumé.',
    'tour.steps.documentDetailsTags.title': 'Modifier les détails : tags',
    'tour.steps.documentDetailsTags.body': 'Utilisez la section tags pour ajouter vos propres tags, revoir les suggestions et classer le document comme vous le souhaitez.',
    'tour.steps.documentDetailsReferences.title': 'Modifier les détails : références',
    'tour.steps.documentDetailsReferences.body': 'La zone de références montre les liens entrants et sortants pour comprendre comment ce document se connecte au reste de la bibliothèque.',
    'tour.steps.documentDetailsMetadata.title': 'Récupérer les métadonnées en ligne',
    'tour.steps.documentDetailsMetadata.body': 'Utilisez cette action pour interroger les fournisseurs en ligne et compléter les métadonnées manquantes avec des informations plus propres.',
    'tour.steps.commentsOverview.title': 'Commentaires du document',
    'tour.steps.commentsOverview.body': 'Cette page de commentaires est l’endroit où vous rédigez le commentaire global d’un document en vous appuyant sur les notes enregistrées.',
    'tour.steps.readerHighlights.title': 'Surlignages dans le lecteur',
    'tour.steps.readerHighlights.body': 'Dans le lecteur PDF, vous pouvez surligner directement sur la page et travailler dans le document.',
    'tour.steps.readerNotes.title': 'Notes dans le lecteur',
    'tour.steps.readerNotes.body': 'Ajoutez des notes directement dans le lecteur et attachez-les à l’endroit exact de votre lecture.',
    'tour.steps.readerSearch.title': 'Recherche dans le lecteur',
    'tour.steps.readerSearch.body': 'Utilisez la recherche du lecteur pour trouver du texte dans le document et naviguer entre les résultats.',
    'tour.steps.referencesWork.title': 'Mes références',
    'tour.steps.referencesWork.body': 'Vous pouvez ajouter vos travaux ici et gérer les références qui leur sont liées.',
    'tour.steps.notesListOverview.title': 'Notes de tous les documents',
    'tour.steps.notesListOverview.body': 'Cette liste rassemble les notes de tous les documents afin de tout parcourir au même endroit avant de modifier la note sélectionnée.',
    'tour.steps.notesOverview.title': 'Notes',
    'tour.steps.notesOverview.body': 'Vous pouvez y gérer vos notes et les modifier à la volée.',
    'tour.steps.mapsOverview.title': 'Cartes',
    'tour.steps.mapsOverview.body': 'Créez des connexions visuelles et des relations entre articles, documents et vos propres travaux.',
    'tour.steps.metadataOverview.title': 'Métadonnées',
    'tour.steps.metadataOverview.body': 'Importez des métadonnées depuis le web et gérez les informations manquantes des documents de votre bibliothèque.',
    'tour.steps.settingsOptions.title': 'Options des réglages',
    'tour.steps.settingsOptions.body': 'Ces sections regroupent les principales préférences de l’application, de la configuration générale à l’apparence, au traitement, aux données et à la section À propos.',
  },
}

const AppTourContext = createContext<AppTourContextValue>({
  isOpen: false,
  isGlobalTourRunning: false,
  startCurrentPageTour: () => undefined,
  startGlobalAppTour: () => undefined,
  closeCurrentPageTour: () => undefined,
  nextTourStep: () => undefined,
  previousTourStep: () => undefined,
  skipCurrentPageTour: () => undefined,
  canStartCurrentPageTour: false,
  hasCurrentPageTour: false,
  currentPageTourUnavailableReason: null,
})

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function normalizeTourPathname(pathname: string | null) {
  if (!pathname || pathname === '/') return '/'
  return pathname.replace(/\/+$/, '') || '/'
}

function queryTourTarget(targetTourId: string) {
  return document.querySelector<HTMLElement>(`${TARGET_SELECTOR_PREFIX}${targetTourId}"]`)
}

function measureTourTarget(targetTourId: string): SpotlightRect | null {
  const element = queryTourTarget(targetTourId)
  if (!element) return null

  const rect = element.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null

  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  }
}

function buildGlobalTourHref(step: AppGlobalTourStep) {
  const search = new URLSearchParams(step.routeQuery ?? {})
  const query = search.toString()
  return query ? `${step.routePath}?${query}` : step.routePath
}

function doesGlobalTourStepMatchRoute(
  step: AppGlobalTourStep,
  pathname: string,
  searchParams: { get: (key: string) => string | null },
) {
  if (step.routePath !== pathname) return false
  return Object.entries(step.routeQuery ?? {}).every(([key, value]) => searchParams.get(key) === value)
}

function logGlobalTour(message: string, details?: Record<string, unknown>) {
  if (details) {
    console.info(`${GLOBAL_TOUR_LOG_PREFIX} ${message}`, details)
    return
  }

  console.info(`${GLOBAL_TOUR_LOG_PREFIX} ${message}`)
}

function translateTour(locale: AppLocale, key: string, params?: Record<string, string | number>) {
  const localized = APP_TOUR_TRANSLATIONS[locale]?.[key]
  if (localized) {
    return Object.entries(params ?? {}).reduce(
      (message, [paramKey, value]) => message.replaceAll(`{${paramKey}}`, String(value)),
      localized,
    )
  }

  return translate(locale, key, params)
}

function computePlacement(
  preferred: AppTourPlacement,
  rect: SpotlightRect,
  viewportWidth: number,
  viewportHeight: number,
) {
  const remaining = {
    top: rect.top,
    bottom: viewportHeight - (rect.top + rect.height),
    left: rect.left,
    right: viewportWidth - (rect.left + rect.width),
  }

  if (preferred === 'top' && remaining.top >= 220) return 'top'
  if (preferred === 'bottom' && remaining.bottom >= 220) return 'bottom'
  if (preferred === 'left' && remaining.left >= BALLOON_WIDTH + GAP + VIEWPORT_PADDING) return 'left'
  if (preferred === 'right' && remaining.right >= BALLOON_WIDTH + GAP + VIEWPORT_PADDING) return 'right'

  const ranked = (Object.entries(remaining) as Array<[AppTourPlacement, number]>)
    .sort((left, right) => right[1] - left[1])
    .map(([placement]) => placement)

  return ranked[0] ?? preferred
}

function buildBalloonStyle(rect: SpotlightRect, placement: AppTourPlacement): CSSProperties {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  if (placement === 'top' || placement === 'bottom') {
    const left = clamp(
      rect.left + rect.width / 2 - BALLOON_WIDTH / 2,
      VIEWPORT_PADDING,
      viewportWidth - BALLOON_WIDTH - VIEWPORT_PADDING,
    )
    const top = placement === 'top'
      ? Math.max(VIEWPORT_PADDING, rect.top - GAP - 210)
      : Math.min(viewportHeight - 210 - VIEWPORT_PADDING, rect.top + rect.height + GAP)
    return { top, left, width: BALLOON_WIDTH }
  }

  const left = placement === 'left'
    ? Math.max(VIEWPORT_PADDING, rect.left - BALLOON_WIDTH - GAP)
    : Math.min(viewportWidth - BALLOON_WIDTH - VIEWPORT_PADDING, rect.left + rect.width + GAP)
  const top = clamp(
    rect.top + rect.height / 2 - 105,
    VIEWPORT_PADDING,
    viewportHeight - 210 - VIEWPORT_PADDING,
  )

  return { top, left, width: BALLOON_WIDTH }
}

function buildArrowPath(rect: SpotlightRect, balloonStyle: CSSProperties) {
  const balloonLeft = Number(balloonStyle.left ?? 0)
  const balloonTop = Number(balloonStyle.top ?? 0)
  const balloonWidth = Number(balloonStyle.width ?? BALLOON_WIDTH)
  const balloonHeight = 210
  const fromX = balloonLeft + balloonWidth / 2
  const fromY = balloonTop + balloonHeight / 2
  const toX = rect.left + rect.width / 2
  const toY = rect.top + rect.height / 2
  const midX = (fromX + toX) / 2
  return `M ${fromX} ${fromY} Q ${midX} ${fromY} ${toX} ${toY}`
}

function Spotlight({
  rect,
  title,
  body,
  locale,
  placement,
  onBack,
  onNext,
  onClose,
  isFirstStep,
  isLastStep,
  progressPercent,
}: {
  rect: SpotlightRect
  title: string
  body: string
  locale: AppLocale
  placement: AppTourPlacement
  onBack: () => void
  onNext: () => void
  onClose: () => void
  isFirstStep: boolean
  isLastStep: boolean
  progressPercent: number
}) {
  const balloonStyle = buildBalloonStyle(rect, placement)
  const arrowPath = buildArrowPath(rect, balloonStyle)

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[1600]">
      <div className="absolute inset-0 bg-slate-950/18" />
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <marker
            id="tour-arrow-head"
            markerWidth="10"
            markerHeight="10"
            refX="8"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M 0 0 L 9 3 L 0 6 z" fill="rgba(253, 186, 116, 0.95)" />
          </marker>
        </defs>
        <path
          d={arrowPath}
          fill="none"
          stroke="rgba(253, 186, 116, 0.95)"
          strokeWidth="2.5"
          strokeDasharray="6 6"
          markerEnd="url(#tour-arrow-head)"
        />
      </svg>

      <div
        className="pointer-events-none absolute rounded-[22px] border-2 border-amber-300/95 bg-white/5 shadow-[0_0_0_9999px_rgba(15,23,42,0.12),0_0_0_12px_rgba(253,186,116,0.12)] transition-all duration-200"
        style={{
          top: rect.top - 8,
          left: rect.left - 8,
          width: rect.width + 16,
          height: rect.height + 16,
        }}
      />

      <div
        className="pointer-events-auto absolute overflow-hidden rounded-3xl border border-amber-200/50 bg-background/98 p-5 shadow-[0_28px_90px_rgba(15,23,42,0.42)]"
        style={balloonStyle}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
            <Lightbulb className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={translateTour(locale, 'tour.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onBack} disabled={isFirstStep}>
            <ChevronLeft className="h-4 w-4" />
            {translateTour(locale, 'tour.back')}
          </Button>
          <Button size="sm" onClick={onNext}>
            {isLastStep ? translateTour(locale, 'tour.finish') : translateTour(locale, 'tour.next')}
            {!isLastStep ? <ArrowRight className="h-4 w-4" /> : null}
          </Button>
        </div>

        <div className="absolute inset-x-0 bottom-0 h-1.5 bg-amber-100/70">
          <div
            className="h-full bg-amber-400 transition-[width] duration-200"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function AppTourProvider({
  children,
  enabled,
  autoStartGlobalTour = false,
  onGlobalTourComplete,
}: AppTourProviderProps) {
  const { locale } = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const normalizedPathname = normalizeTourPathname(pathname)
  const normalizedSearchParams = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams])
  const [isOpen, setIsOpen] = useState(false)
  const [tourMode, setTourMode] = useState<'page' | 'global' | null>(null)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [rect, setRect] = useState<SpotlightRect | null>(null)
  const [resolvedPlacement, setResolvedPlacement] = useState<AppTourPlacement>('bottom')
  const [currentPageAvailableTargetIds, setCurrentPageAvailableTargetIds] = useState<string[]>([])
  const previousPathnameRef = useRef<string | null>(null)
  const lastGlobalNavigationRef = useRef<string | null>(null)
  const hasAutoStartedGlobalTourRef = useRef(false)
  const currentPageTourSteps = useMemo(
    () => APP_PAGE_TOURS[normalizedPathname] ?? [],
    [normalizedPathname],
  )
  const runnableCurrentPageTourSteps = useMemo(
    () => currentPageTourSteps.filter((step) => currentPageAvailableTargetIds.includes(step.targetTourId)),
    [currentPageAvailableTargetIds, currentPageTourSteps],
  )
  const hasCurrentPageTour = currentPageTourSteps.length > 0
  const isGlobalTourRunning = isOpen && tourMode === 'global'
  const activeTourSteps = tourMode === 'global' ? APP_GLOBAL_TOUR_STEPS : runnableCurrentPageTourSteps
  const currentStep = activeTourSteps[currentStepIndex] ?? null

  const completeGlobalTour = useCallback((reason: 'completed' | 'dismissed') => {
    setIsOpen(false)
    setTourMode(null)
    setRect(null)
    onGlobalTourComplete?.(reason)
  }, [onGlobalTourComplete])

  const closeCurrentPageTour = useCallback(() => {
    if (tourMode === 'global') {
      completeGlobalTour('dismissed')
      return
    }

    setIsOpen(false)
    setTourMode(null)
    setRect(null)
  }, [completeGlobalTour, tourMode])

  const canStartCurrentPageTour = enabled && runnableCurrentPageTourSteps.length > 0
  const currentPageTourUnavailableReason = canStartCurrentPageTour
    ? null
    : translate(locale, 'topBar.pageGuideUnavailable')

  const startCurrentPageTour = useCallback(() => {
    if (!canStartCurrentPageTour) return
    logGlobalTour('starting page guide', { route: normalizedPathname })
    lastGlobalNavigationRef.current = null
    setTourMode('page')
    setCurrentStepIndex(0)
    setRect(null)
    setIsOpen(true)
  }, [canStartCurrentPageTour, normalizedPathname])

  const startGlobalAppTour = useCallback(() => {
    if (!enabled || APP_GLOBAL_TOUR_STEPS.length === 0) return
    logGlobalTour('starting global onboarding', { route: normalizedPathname })
    lastGlobalNavigationRef.current = null
    hasAutoStartedGlobalTourRef.current = true
    setTourMode('global')
    setCurrentStepIndex(0)
    setRect(null)
    setIsOpen(true)
  }, [enabled, normalizedPathname])

  const skipCurrentPageTour = useCallback(() => {
    closeCurrentPageTour()
  }, [closeCurrentPageTour])

  const nextTourStep = useCallback(() => {
    setRect(null)
    setCurrentStepIndex((current) => {
      if (current >= activeTourSteps.length - 1) {
        if (tourMode === 'global') {
          completeGlobalTour('completed')
        } else {
          setIsOpen(false)
          setTourMode(null)
        }
        return current
      }
      return current + 1
    })
  }, [activeTourSteps.length, completeGlobalTour, tourMode])

  const previousTourStep = useCallback(() => {
    setRect(null)
    setCurrentStepIndex((current) => Math.max(0, current - 1))
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined' || !enabled || !hasCurrentPageTour) {
      setCurrentPageAvailableTargetIds([])
      return
    }

    let frameId = 0
    const evaluateTargets = () => {
      setCurrentPageAvailableTargetIds(
        currentPageTourSteps
          .filter((step) => Boolean(measureTourTarget(step.targetTourId)))
          .map((step) => step.targetTourId),
      )
    }
    const scheduleEvaluation = () => {
      if (frameId) return
      frameId = window.requestAnimationFrame(() => {
        frameId = 0
        evaluateTargets()
      })
    }

    scheduleEvaluation()

    const observer = new MutationObserver(() => {
      scheduleEvaluation()
    })

    observer.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
    })

    window.addEventListener('resize', scheduleEvaluation)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', scheduleEvaluation)
      if (frameId) {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [currentPageTourSteps, enabled, hasCurrentPageTour])

  useEffect(() => {
    if (!enabled && isOpen) {
      closeCurrentPageTour()
    }
  }, [closeCurrentPageTour, enabled, isOpen])

  useEffect(() => {
    if (previousPathnameRef.current === null) {
      previousPathnameRef.current = normalizedPathname
      return
    }

    if (previousPathnameRef.current !== normalizedPathname && isOpen && tourMode === 'page') {
      closeCurrentPageTour()
    }

    previousPathnameRef.current = normalizedPathname
  }, [closeCurrentPageTour, isOpen, normalizedPathname, tourMode])

  useEffect(() => {
    if (!isOpen) return
    if (activeTourSteps.length === 0) {
      closeCurrentPageTour()
      return
    }
    setCurrentStepIndex((current) => Math.min(current, activeTourSteps.length - 1))
  }, [activeTourSteps.length, closeCurrentPageTour, isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        skipCurrentPageTour()
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        nextTourStep()
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        previousTourStep()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, nextTourStep, previousTourStep, skipCurrentPageTour])

  useEffect(() => {
    if (!autoStartGlobalTour || !enabled || isOpen || hasAutoStartedGlobalTourRef.current) return
    startGlobalAppTour()
  }, [autoStartGlobalTour, enabled, isOpen, startGlobalAppTour])

  useEffect(() => {
    if (!isOpen || tourMode !== 'global' || !currentStep) return

    const currentGlobalStep = currentStep as AppGlobalTourStep
    const currentHref = buildGlobalTourHref(currentGlobalStep)
    const routeMatches = doesGlobalTourStepMatchRoute(currentGlobalStep, normalizedPathname, normalizedSearchParams)
    if (routeMatches) {
      lastGlobalNavigationRef.current = null
      return
    }

    if (lastGlobalNavigationRef.current === currentHref) return

    lastGlobalNavigationRef.current = currentHref
    logGlobalTour('route transition start', {
      stepId: currentGlobalStep.id,
      route: currentHref,
      currentPathname: normalizedPathname,
    })
    router.push(currentHref)
  }, [currentStep, isOpen, normalizedPathname, normalizedSearchParams, router, tourMode])

  useLayoutEffect(() => {
    if (!isOpen || !currentStep) return

    let cancelled = false
    let frameId = 0
    const deadline = Date.now() + TARGET_WAIT_TIMEOUT_MS

    const measure = () => {
      if (cancelled) return
      if (tourMode === 'global') {
        const globalStep = currentStep as AppGlobalTourStep
        if (!doesGlobalTourStepMatchRoute(globalStep, normalizedPathname, normalizedSearchParams)) {
          if (Date.now() >= deadline) {
            logGlobalTour('route transition timeout, skipping step', {
              stepId: globalStep.id,
              targetRoute: buildGlobalTourHref(globalStep),
              currentPathname: normalizedPathname,
            })
            nextTourStep()
            return
          }
          frameId = window.requestAnimationFrame(measure)
          return
        }
      }

      const spotlightRect = measureTourTarget(currentStep.targetTourId)
      if (!spotlightRect) {
        if (Date.now() >= deadline) {
          if (tourMode === 'global') {
            logGlobalTour('target lookup timeout, skipping step', {
              stepId: currentStep.id,
              targetTourId: currentStep.targetTourId,
              currentPathname: normalizedPathname,
            })
            nextTourStep()
          } else {
            closeCurrentPageTour()
          }
          return
        }
        frameId = window.requestAnimationFrame(measure)
        return
      }

      const element = queryTourTarget(currentStep.targetTourId)
      if (!element) return
      if (tourMode === 'global') {
        logGlobalTour('target resolved', {
          stepId: currentStep.id,
          targetTourId: currentStep.targetTourId,
          currentPathname: normalizedPathname,
        })
      }
      element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' })
      setRect(spotlightRect)
      setResolvedPlacement(
        computePlacement(currentStep.placement, spotlightRect, window.innerWidth, window.innerHeight),
      )
      if (tourMode === 'global') {
        logGlobalTour('spotlight rect created', {
          stepId: currentStep.id,
          targetTourId: currentStep.targetTourId,
          top: spotlightRect.top,
          left: spotlightRect.left,
          width: spotlightRect.width,
          height: spotlightRect.height,
        })
      }
    }

    measure()

    return () => {
      cancelled = true
      if (frameId) {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [closeCurrentPageTour, currentStep, isOpen, nextTourStep, normalizedPathname, normalizedSearchParams, tourMode])

  useEffect(() => {
    if (!isOpen || !currentStep || !rect) return

    const updateRect = () => {
      const spotlightRect = measureTourTarget(currentStep.targetTourId)
      if (!spotlightRect) return
      setRect(spotlightRect)
      setResolvedPlacement(
        computePlacement(currentStep.placement, spotlightRect, window.innerWidth, window.innerHeight),
      )
    }

    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)
    return () => {
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
    }
  }, [currentStep, isOpen, rect])

  const value = useMemo<AppTourContextValue>(
    () => ({
      isOpen,
      isGlobalTourRunning,
      startCurrentPageTour,
      startGlobalAppTour,
      closeCurrentPageTour,
      nextTourStep,
      previousTourStep,
      skipCurrentPageTour,
      canStartCurrentPageTour,
      hasCurrentPageTour,
      currentPageTourUnavailableReason,
    }),
    [
      canStartCurrentPageTour,
      closeCurrentPageTour,
      currentPageTourUnavailableReason,
      hasCurrentPageTour,
      isGlobalTourRunning,
      isOpen,
      nextTourStep,
      previousTourStep,
      skipCurrentPageTour,
      startGlobalAppTour,
      startCurrentPageTour,
    ],
  )

  const progressPercent = currentStep
    ? ((currentStepIndex + 1) / Math.max(activeTourSteps.length, 1)) * 100
    : 0
  const hasVisibleSpotlight = Boolean(isOpen && currentStep && rect)
  const spotlightRect = rect

  return (
    <AppTourContext.Provider value={value}>
      <div className={cn(hasVisibleSpotlight ? 'tour-active' : undefined)}>{children}</div>
      {hasVisibleSpotlight && spotlightRect ? (
        <Spotlight
          rect={spotlightRect}
          title={translateTour(locale, currentStep.titleKey)}
          body={translateTour(locale, currentStep.bodyKey)}
          locale={locale}
          placement={resolvedPlacement}
          onBack={previousTourStep}
          onNext={nextTourStep}
          onClose={skipCurrentPageTour}
          isFirstStep={currentStepIndex === 0}
          isLastStep={currentStepIndex === activeTourSteps.length - 1}
          progressPercent={progressPercent}
        />
      ) : null}
    </AppTourContext.Provider>
  )
}

export function useAppTour() {
  return useContext(AppTourContext)
}
