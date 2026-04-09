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

export type AppPageTourRegistry = Record<string, AppTourStep[]>

export const APP_PAGE_TOURS: AppPageTourRegistry = {
  '/': [
    {
      id: 'navigator-overview',
      targetTourId: 'shell-nav',
      titleKey: 'tour.steps.navigatorOverview.title',
      bodyKey: 'tour.steps.navigatorOverview.body',
      placement: 'right',
    },
    {
      id: 'home-libraries',
      targetTourId: 'home-libraries',
      titleKey: 'tour.steps.homeLibraries.title',
      bodyKey: 'tour.steps.homeLibraries.body',
      placement: 'bottom',
    },
    {
      id: 'home-recent-activity',
      targetTourId: 'home-activity',
      titleKey: 'tour.steps.homeActivity.title',
      bodyKey: 'tour.steps.homeActivity.body',
      placement: 'bottom',
    },
    {
      id: 'home-recent-opened',
      targetTourId: 'home-recent-opened',
      titleKey: 'tour.steps.readerContinue.title',
      bodyKey: 'tour.steps.readerContinue.body',
      placement: 'bottom',
    },
  ],
  '/search': [
    {
      id: 'search-simple-mode',
      targetTourId: 'search-simple-button',
      titleKey: 'tour.steps.searchSimple.title',
      bodyKey: 'tour.steps.searchSimple.body',
      placement: 'bottom',
    },
    {
      id: 'search-complex-mode',
      targetTourId: 'search-complex-button',
      titleKey: 'tour.steps.searchComplex.title',
      bodyKey: 'tour.steps.searchComplex.body',
      placement: 'bottom',
    },
    {
      id: 'search-filters',
      targetTourId: 'search-filters',
      titleKey: 'tour.steps.searchFilters.title',
      bodyKey: 'tour.steps.searchFilters.body',
      placement: 'right',
    },
  ],
  '/reader': [
    {
      id: 'reader-resume',
      targetTourId: 'reader-continue',
      titleKey: 'tour.steps.readerResume.title',
      bodyKey: 'tour.steps.readerResume.body',
      placement: 'bottom',
    },
    {
      id: 'reader-recent-opened',
      targetTourId: 'reader-recent-opened',
      titleKey: 'tour.steps.readerContinue.title',
      bodyKey: 'tour.steps.readerContinue.body',
      placement: 'top',
    },
  ],
  '/libraries': [
    {
      id: 'libraries-toolbar',
      targetTourId: 'libraries-toolbar',
      titleKey: 'tour.steps.librariesToolbar.title',
      bodyKey: 'tour.steps.librariesToolbar.body',
      placement: 'bottom',
    },
    {
      id: 'libraries-import',
      targetTourId: 'libraries-import',
      titleKey: 'tour.steps.librariesImport.title',
      bodyKey: 'tour.steps.librariesImport.body',
      placement: 'bottom',
    },
    {
      id: 'libraries-physical-book',
      targetTourId: 'libraries-physical-book',
      titleKey: 'tour.steps.librariesPhysicalBook.title',
      bodyKey: 'tour.steps.librariesPhysicalBook.body',
      placement: 'bottom',
    },
    {
      id: 'libraries-views',
      targetTourId: 'libraries-view-mode',
      titleKey: 'tour.steps.librariesViews.title',
      bodyKey: 'tour.steps.librariesViews.body',
      placement: 'bottom',
    },
    {
      id: 'libraries-list',
      targetTourId: 'libraries-list',
      titleKey: 'tour.steps.librariesList.title',
      bodyKey: 'tour.steps.librariesList.body',
      placement: 'top',
    },
  ],
  '/documents': [
    {
      id: 'document-details-information',
      targetTourId: 'documents-information',
      titleKey: 'tour.steps.documentDetailsInformation.title',
      bodyKey: 'tour.steps.documentDetailsInformation.body',
      placement: 'right',
    },
    {
      id: 'document-details-tags',
      targetTourId: 'documents-tags',
      titleKey: 'tour.steps.documentDetailsTags.title',
      bodyKey: 'tour.steps.documentDetailsTags.body',
      placement: 'right',
    },
    {
      id: 'document-details-references',
      targetTourId: 'documents-references',
      titleKey: 'tour.steps.documentDetailsReferences.title',
      bodyKey: 'tour.steps.documentDetailsReferences.body',
      placement: 'left',
    },
    {
      id: 'document-details-metadata',
      targetTourId: 'documents-fetch-metadata',
      titleKey: 'tour.steps.documentDetailsMetadata.title',
      bodyKey: 'tour.steps.documentDetailsMetadata.body',
      placement: 'bottom',
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
      id: 'reader-highlights',
      targetTourId: 'reader-highlight',
      titleKey: 'tour.steps.readerHighlights.title',
      bodyKey: 'tour.steps.readerHighlights.body',
      placement: 'bottom',
    },
    {
      id: 'reader-notes',
      targetTourId: 'reader-notes',
      titleKey: 'tour.steps.readerNotes.title',
      bodyKey: 'tour.steps.readerNotes.body',
      placement: 'bottom',
    },
    {
      id: 'reader-search',
      targetTourId: 'reader-search',
      titleKey: 'tour.steps.readerSearch.title',
      bodyKey: 'tour.steps.readerSearch.body',
      placement: 'left',
    },
  ],
  '/references': [
    {
      id: 'references-add-work',
      targetTourId: 'references-add-work',
      titleKey: 'tour.steps.referencesAddWork.title',
      bodyKey: 'tour.steps.referencesAddWork.body',
      placement: 'bottom',
    },
    {
      id: 'references-work',
      targetTourId: 'references-work',
      titleKey: 'tour.steps.referencesWork.title',
      bodyKey: 'tour.steps.referencesWork.body',
      placement: 'bottom',
    },
    {
      id: 'references-style',
      targetTourId: 'references-style',
      titleKey: 'tour.steps.referencesStyle.title',
      bodyKey: 'tour.steps.referencesStyle.body',
      placement: 'bottom',
    },
    {
      id: 'references-copy-all',
      targetTourId: 'references-copy-all',
      titleKey: 'tour.steps.referencesCopyAll.title',
      bodyKey: 'tour.steps.referencesCopyAll.body',
      placement: 'bottom',
    },
    {
      id: 'references-add-reference',
      targetTourId: 'references-add-reference',
      titleKey: 'tour.steps.referencesAddReference.title',
      bodyKey: 'tour.steps.referencesAddReference.body',
      placement: 'bottom',
    },
    {
      id: 'references-recheck',
      targetTourId: 'references-recheck',
      titleKey: 'tour.steps.referencesRecheck.title',
      bodyKey: 'tour.steps.referencesRecheck.body',
      placement: 'bottom',
    },
  ],
  '/notes': [
    {
      id: 'notes-list-overview',
      targetTourId: 'notes-list',
      titleKey: 'tour.steps.notesListOverview.title',
      bodyKey: 'tour.steps.notesListOverview.body',
      placement: 'right',
    },
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
      id: 'maps-workspace',
      targetTourId: 'maps-workspace',
      titleKey: 'tour.steps.mapsWorkspace.title',
      bodyKey: 'tour.steps.mapsWorkspace.body',
      placement: 'bottom',
    },
    {
      id: 'maps-new-view',
      targetTourId: 'maps-new-view',
      titleKey: 'tour.steps.mapsNewView.title',
      bodyKey: 'tour.steps.mapsNewView.body',
      placement: 'bottom',
    },
    {
      id: 'maps-save-as-view',
      targetTourId: 'maps-save-as-view',
      titleKey: 'tour.steps.mapsSaveAsView.title',
      bodyKey: 'tour.steps.mapsSaveAsView.body',
      placement: 'bottom',
    },
    {
      id: 'maps-rebuild-layout',
      targetTourId: 'maps-rebuild-layout',
      titleKey: 'tour.steps.mapsRebuildLayout.title',
      bodyKey: 'tour.steps.mapsRebuildLayout.body',
      placement: 'bottom',
    },
    {
      id: 'maps-delete-map',
      targetTourId: 'maps-delete-map',
      titleKey: 'tour.steps.mapsDeleteMap.title',
      bodyKey: 'tour.steps.mapsDeleteMap.body',
      placement: 'bottom',
    },
    {
      id: 'maps-canvas-editor',
      targetTourId: 'maps-add-controls',
      titleKey: 'tour.steps.mapsCanvasEditor.title',
      bodyKey: 'tour.steps.mapsCanvasEditor.body',
      placement: 'bottom',
    },
    {
      id: 'maps-add-document',
      targetTourId: 'maps-add-document',
      titleKey: 'tour.steps.mapsAddDocument.title',
      bodyKey: 'tour.steps.mapsAddDocument.body',
      placement: 'bottom',
    },
    {
      id: 'maps-add-work',
      targetTourId: 'maps-add-work',
      titleKey: 'tour.steps.mapsAddWork.title',
      bodyKey: 'tour.steps.mapsAddWork.body',
      placement: 'bottom',
    },
    {
      id: 'maps-layout-filter',
      targetTourId: 'maps-layout-filter',
      titleKey: 'tour.steps.mapsLayoutFilter.title',
      bodyKey: 'tour.steps.mapsLayoutFilter.body',
      placement: 'bottom',
    },
    {
      id: 'maps-canvas',
      targetTourId: 'maps-canvas',
      titleKey: 'tour.steps.mapsCanvas.title',
      bodyKey: 'tour.steps.mapsCanvas.body',
      placement: 'bottom',
    },
  ],
  '/metadata': [
    {
      id: 'metadata-fetch-possible',
      targetTourId: 'metadata-fetch-possible',
      titleKey: 'tour.steps.metadataFetchPossible.title',
      bodyKey: 'tour.steps.metadataFetchPossible.body',
      placement: 'bottom',
    },
    {
      id: 'metadata-missing',
      targetTourId: 'metadata-missing',
      titleKey: 'tour.steps.metadataMissing.title',
      bodyKey: 'tour.steps.metadataMissing.body',
      placement: 'bottom',
    },
    {
      id: 'metadata-editor',
      targetTourId: 'metadata-editor',
      titleKey: 'tour.steps.metadataEditor.title',
      bodyKey: 'tour.steps.metadataEditor.body',
      placement: 'right',
    },
  ],
  '/settings': [
    {
      id: 'settings-tour',
      targetTourId: 'settings-nav',
      titleKey: 'tour.steps.settingsOptions.title',
      bodyKey: 'tour.steps.settingsOptions.body',
      placement: 'right',
    },
  ],
}
