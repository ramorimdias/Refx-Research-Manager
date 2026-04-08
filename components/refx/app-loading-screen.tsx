'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { AppLocale } from '@/lib/localization'
import { cn } from '@/lib/utils'

const LOADING_COPY: Record<AppLocale, {
  brand: string
  phrases: string[]
}> = {
  en: {
    brand: 'Refx Research Manager',
    phrases: [
      'Loading next Nobel Prize works...',
      'Loading cure of cancer...',
      'Loading refrigerator user manual...',
      'Indexing groundbreaking footnotes...',
      'Calibrating academic chaos...',
      'Summoning very important PDFs...',
      'Dusting off unread masterpieces...',
      'Organizing suspiciously ambitious reading plans...',
      'Untangling references with heroic confidence...',
      'Preparing your future literature review...',
      'Warming up citation engines...',
      'Locating the paragraph you swear you read yesterday...',
      'Loading the paper that will absolutely fix reviewer #2...',
      'Sorting citations like socks that almost match...',
      'Checking whether that DOI was real or just confidence...',
      'Loading highly peer-reviewed procrastination...',
      'Reheating your finest half-finished ideas...',
      'Preparing world-changing research and one random PDF about chairs...',
      'Counting how many tabs became a methodology...',
      'Looking for the sentence you highlighted with great conviction...',
    ],
  },
  'pt-BR': {
    brand: 'Refx Research Manager',
    phrases: [
      'Carregando os próximos trabalhos ganhadores do Nobel...',
      'Carregando a cura do câncer...',
      'Carregando o manual da geladeira...',
      'Indexando notas de rodapé revolucionárias...',
      'Calibrando o caos acadêmico...',
      'Invocando PDFs muito importantes...',
      'Tirando a poeira de obras-primas ainda não lidas...',
      'Organizando planos de leitura suspeitamente ambiciosos...',
      'Desembaraçando referências com confiança heroica...',
      'Preparando sua futura revisão de literatura...',
      'Aquecendo os motores de citação...',
      'Procurando o parágrafo que você jura que leu ontem...',
      'Carregando o artigo que definitivamente vai convencer o revisor 2...',
      'Separando citações como meias que quase combinam...',
      'Confirmando se esse DOI existe mesmo ou foi só coragem...',
      'Carregando procrastinação altamente revisada por pares...',
      'Reaquecendo suas melhores ideias pela metade...',
      'Preparando pesquisas que vão mudar o mundo e um PDF aleatório sobre cadeiras...',
      'Contando quantas abas viraram metodologia...',
      'Procurando a frase que você destacou com convicção absoluta...',
    ],
  },
  fr: {
    brand: 'Refx Research Manager',
    phrases: [
      'Chargement des prochains travaux Nobel...',
      'Chargement du remède contre le cancer...',
      'Chargement du manuel du réfrigérateur...',
      'Indexation de notes de bas de page révolutionnaires...',
      'Calibration du chaos académique...',
      'Invocation de PDF extrêmement importants...',
      'Dépoussiérage de chefs-d’œuvre encore jamais lus...',
      'Organisation de plans de lecture scandaleusement ambitieux...',
      'Démêlage héroïque des références...',
      'Préparation de votre future revue de littérature...',
      'Mise en chauffe des moteurs de citation...',
      'Recherche du paragraphe que vous jurez avoir lu hier...',
      'Chargement de l’article qui convaincra enfin le relecteur numéro 2...',
      'Tri des citations comme des chaussettes presque assorties...',
      'Vérification que ce DOI existe vraiment et n’était pas juste de l’assurance...',
      'Chargement d’une procrastination relue par les pairs...',
      'Réchauffage de vos meilleures idées à moitié terminées...',
      'Préparation de recherches qui vont changer le monde et d’un PDF aléatoire sur les chaises...',
      'Comptage du nombre d’onglets devenus une méthodologie...',
      'Recherche de la phrase surlignée avec une confiance absolue...',
    ],
  },
}

type AppLoadingScreenProps = {
  className?: string
  compact?: boolean
  locale?: AppLocale
  statusLine?: string
  diagnostics?: string[]
}

function detectLocale(): AppLocale {
  if (typeof window === 'undefined') return 'en'
  const language = window.navigator.language
  if (language.startsWith('pt')) return 'pt-BR'
  if (language.startsWith('fr')) return 'fr'
  return 'en'
}

export function AppLoadingScreen({
  className,
  compact = false,
  locale,
  statusLine,
  diagnostics,
}: AppLoadingScreenProps) {
  const [resolvedLocale, setResolvedLocale] = useState<AppLocale>(locale ?? 'en')
  const [phraseIndex, setPhraseIndex] = useState<number | null>(null)

  useEffect(() => {
    setResolvedLocale(locale ?? detectLocale())
  }, [locale])

  const copy = LOADING_COPY[resolvedLocale] ?? LOADING_COPY.en

  useEffect(() => {
    setPhraseIndex(Math.floor(Math.random() * copy.phrases.length))
  }, [copy.phrases.length])

  const phrase = useMemo(
    () => copy.phrases[phraseIndex ?? 0] ?? copy.phrases[0],
    [copy.phrases, phraseIndex],
  )

  return (
    <div
      className={cn(
        'relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,#dbeafe_0%,#f8fafc_34%,#eef2ff_100%)] px-6 py-10 text-slate-900 dark:bg-[radial-gradient(circle_at_top,#1d2841_0%,#0f172a_36%,#09090b_100%)] dark:text-slate-50',
        compact && 'min-h-[22rem] rounded-[2rem]',
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-16 top-16 h-56 w-56 rounded-full bg-sky-300/20 blur-3xl dark:bg-sky-500/20" />
        <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-amber-300/20 blur-3xl dark:bg-amber-400/10" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-emerald-300/20 blur-3xl dark:bg-emerald-400/10" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-[2rem] border border-white/60 bg-white/72 p-8 shadow-[0_28px_120px_rgba(15,23,42,0.18)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/55 dark:shadow-[0_28px_120px_rgba(2,6,23,0.6)]">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-[1.6rem] border border-white/70 bg-white/90 shadow-lg dark:border-white/10 dark:bg-slate-900/80">
              <Image
                src="/icon.svg"
                alt="Refx"
                width={52}
                height={52}
                className="h-[52px] w-[52px] rounded-xl"
                priority
              />
            </div>

            <div className="mt-8 flex items-center gap-2 text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm font-medium">{copy.brand}</span>
            </div>

            <p className="mt-5 max-w-sm text-sm leading-6 text-muted-foreground">
              {phrase}
            </p>

            {statusLine ? (
              <p className="mt-4 text-xs font-medium uppercase tracking-[0.18em] text-primary/75">
                {statusLine}
              </p>
            ) : null}

            {diagnostics && diagnostics.length > 0 ? (
              <div className="mt-4 w-full rounded-2xl border border-white/60 bg-white/70 p-4 text-left dark:border-white/10 dark:bg-slate-900/65">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Startup diagnostics
                </p>
                <div className="mt-3 space-y-2">
                  {diagnostics.map((entry) => (
                    <p key={entry} className="font-mono text-xs text-muted-foreground">
                      {entry}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
