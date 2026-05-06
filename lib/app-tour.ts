'use client'

export type AppTourPlacement = 'top' | 'bottom' | 'left' | 'right'

export const APP_TOUR_ENABLED = true

export type AppTourStep = {
  id: string
  targetTourId: string
  titleKey: string
  bodyKey: string
  placement: AppTourPlacement
}

export type AppGlobalTourStep = AppTourStep & {
  routePath: string
  routeQuery?: Record<string, string>
}

export type AppPageTourRegistry = Record<string, AppTourStep[]>

export const APP_PAGE_TOURS: AppPageTourRegistry = {
  '/': [
    {
      id: 'home-overview',
      targetTourId: 'home-greeting',
      titleKey: 'tour.steps.homeOverview.title',
      bodyKey: 'tour.steps.homeOverview.body',
      placement: 'bottom',
    },
  ],
  '/search': [
    {
      id: 'search-overview',
      targetTourId: 'search-query',
      titleKey: 'tour.steps.searchOverview.title',
      bodyKey: 'tour.steps.searchOverview.body',
      placement: 'right',
    },
  ],
  '/reader': [
    {
      id: 'reader-overview',
      targetTourId: 'reader-continue',
      titleKey: 'tour.steps.readerOverview.title',
      bodyKey: 'tour.steps.readerOverview.body',
      placement: 'bottom',
    },
  ],
  '/discover': [
    {
      id: 'discover-overview',
      targetTourId: 'discover-overview',
      titleKey: 'tour.steps.discoverOverview.title',
      bodyKey: 'tour.steps.discoverOverview.body',
      placement: 'bottom',
    },
  ],
  '/libraries': [
    {
      id: 'libraries-overview',
      targetTourId: 'libraries-list',
      titleKey: 'tour.steps.librariesOverview.title',
      bodyKey: 'tour.steps.librariesOverview.body',
      placement: 'top',
    },
  ],
  '/documents': [
    {
      id: 'documents-overview',
      targetTourId: 'documents-information',
      titleKey: 'tour.steps.documentsOverview.title',
      bodyKey: 'tour.steps.documentsOverview.body',
      placement: 'right',
    },
  ],
  '/comments': [
    {
      id: 'comments-overview',
      targetTourId: 'comments-draft',
      titleKey: 'tour.steps.commentsOverview.title',
      bodyKey: 'tour.steps.commentsOverview.body',
      placement: 'left',
    },
  ],
  '/reader/view': [
    {
      id: 'reader-view-overview',
      targetTourId: 'reader-search',
      titleKey: 'tour.steps.readerViewOverview.title',
      bodyKey: 'tour.steps.readerViewOverview.body',
      placement: 'left',
    },
  ],
  '/references': [
    {
      id: 'references-overview',
      targetTourId: 'references-work',
      titleKey: 'tour.steps.referencesOverview.title',
      bodyKey: 'tour.steps.referencesOverview.body',
      placement: 'bottom',
    },
  ],
  '/notes': [
    {
      id: 'notes-overview',
      targetTourId: 'notes-editor',
      titleKey: 'tour.steps.notesOverview.title',
      bodyKey: 'tour.steps.notesOverview.body',
      placement: 'left',
    },
  ],
  '/maps': [
    {
      id: 'maps-overview',
      targetTourId: 'maps-workspace',
      titleKey: 'tour.steps.mapsOverview.title',
      bodyKey: 'tour.steps.mapsOverview.body',
      placement: 'bottom',
    },
  ],
  '/metadata': [
    {
      id: 'metadata-overview',
      targetTourId: 'metadata-editor',
      titleKey: 'tour.steps.metadataOverview.title',
      bodyKey: 'tour.steps.metadataOverview.body',
      placement: 'right',
    },
  ],
  '/settings': [
    {
      id: 'settings-overview',
      targetTourId: 'settings-nav',
      titleKey: 'tour.steps.settingsOverview.title',
      bodyKey: 'tour.steps.settingsOverview.body',
      placement: 'right',
    },
  ],
}

export const APP_GLOBAL_TOUR_STEPS: AppGlobalTourStep[] = [
  {
    id: 'global-home-overview',
    routePath: '/',
    targetTourId: 'home-greeting',
    titleKey: 'tour.steps.homeOverview.title',
    bodyKey: 'tour.steps.homeOverview.body',
    placement: 'bottom',
  },
  {
    id: 'global-search-overview',
    routePath: '/search',
    routeQuery: { tour: '1' },
    targetTourId: 'search-query',
    titleKey: 'tour.steps.searchOverview.title',
    bodyKey: 'tour.steps.searchOverview.body',
    placement: 'right',
  },
  {
    id: 'global-libraries-overview',
    routePath: '/libraries',
    targetTourId: 'libraries-list',
    titleKey: 'tour.steps.librariesOverview.title',
    bodyKey: 'tour.steps.librariesOverview.body',
    placement: 'top',
  },
  {
    id: 'global-documents-overview',
    routePath: '/documents',
    routeQuery: { tour: '1' },
    targetTourId: 'documents-information',
    titleKey: 'tour.steps.documentsOverview.title',
    bodyKey: 'tour.steps.documentsOverview.body',
    placement: 'right',
  },
  {
    id: 'global-reader-overview',
    routePath: '/reader',
    targetTourId: 'reader-continue',
    titleKey: 'tour.steps.readerOverview.title',
    bodyKey: 'tour.steps.readerOverview.body',
    placement: 'bottom',
  },
  {
    id: 'global-discover-overview',
    routePath: '/discover',
    targetTourId: 'discover-overview',
    titleKey: 'tour.steps.discoverOverview.title',
    bodyKey: 'tour.steps.discoverOverview.body',
    placement: 'bottom',
  },
  {
    id: 'global-references-overview',
    routePath: '/references',
    targetTourId: 'references-work',
    titleKey: 'tour.steps.referencesOverview.title',
    bodyKey: 'tour.steps.referencesOverview.body',
    placement: 'bottom',
  },
  {
    id: 'global-notes-overview',
    routePath: '/notes',
    targetTourId: 'notes-editor',
    titleKey: 'tour.steps.notesOverview.title',
    bodyKey: 'tour.steps.notesOverview.body',
    placement: 'left',
  },
  {
    id: 'global-maps-overview',
    routePath: '/maps',
    targetTourId: 'maps-workspace',
    titleKey: 'tour.steps.mapsOverview.title',
    bodyKey: 'tour.steps.mapsOverview.body',
    placement: 'bottom',
  },
  {
    id: 'global-metadata-overview',
    routePath: '/metadata',
    targetTourId: 'metadata-editor',
    titleKey: 'tour.steps.metadataOverview.title',
    bodyKey: 'tour.steps.metadataOverview.body',
    placement: 'right',
  },
  {
    id: 'global-comments-overview',
    routePath: '/comments',
    routeQuery: { tour: '1' },
    targetTourId: 'comments-draft',
    titleKey: 'tour.steps.commentsOverview.title',
    bodyKey: 'tour.steps.commentsOverview.body',
    placement: 'left',
  },
  {
    id: 'global-settings-overview',
    routePath: '/settings',
    targetTourId: 'settings-nav',
    titleKey: 'tour.steps.settingsOverview.title',
    bodyKey: 'tour.steps.settingsOverview.body',
    placement: 'right',
  },
]
