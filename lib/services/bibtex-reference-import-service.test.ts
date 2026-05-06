import test from 'node:test'
import assert from 'node:assert/strict'
import { parseBibtexReferences } from '@/lib/services/bibtex-reference-import-service'

test('parseBibtexReferences imports article fields and normalizes authors', () => {
  const input = `
@article{doe2024,
  title = {Thermal Management in EV Packs},
  author = {Doe, Jane and Smith, John},
  year = {2024},
  journal = {Journal of Battery Systems},
  doi = {10.1000/abc123},
  abstract = {A practical overview.}
}
`

  const [reference] = parseBibtexReferences(input, 'paperpile')

  assert.equal(reference?.sourceProvider, 'paperpile')
  assert.equal(reference?.type, 'article')
  assert.equal(reference?.citationKey, 'doe2024')
  assert.equal(reference?.title, 'Thermal Management in EV Packs')
  assert.equal(reference?.authors, 'Jane Doe; John Smith')
  assert.equal(reference?.year, 2024)
  assert.equal(reference?.journal, 'Journal of Battery Systems')
  assert.equal(reference?.doi, '10.1000/abc123')
  assert.equal(reference?.abstract, 'A practical overview.')
})

test('parseBibtexReferences maps inproceedings to inproceedings and preserves raw bibtex', () => {
  const input = `
@inproceedings{lee2023,
  title = {{AI} for Battery Diagnostics},
  author = {Lee, Mina},
  booktitle = {Proceedings of the Smart Energy Conference},
  pages = {10--18},
  note = {Best paper nominee}
}
`

  const [reference] = parseBibtexReferences(input, 'mendeley')

  assert.equal(reference?.type, 'inproceedings')
  assert.equal(reference?.title, 'AI for Battery Diagnostics')
  assert.equal(reference?.authors, 'Mina Lee')
  assert.equal(reference?.booktitle, 'Proceedings of the Smart Energy Conference')
  assert.equal(reference?.pages, '10-18')
  assert.equal(reference?.abstract, 'Best paper nominee')
  assert.match(reference?.bibtex ?? '', /@inproceedings/i)
})

test('parseBibtexReferences falls back to misc for unknown types', () => {
  const input = `
@dataset{refx2025,
  title = {Battery Benchmark Dataset}
}
`

  const [reference] = parseBibtexReferences(input, 'endnote')

  assert.equal(reference?.type, 'misc')
  assert.equal(reference?.title, 'Battery Benchmark Dataset')
})
