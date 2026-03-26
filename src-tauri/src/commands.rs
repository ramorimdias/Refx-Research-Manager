use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Command;
use tauri::{AppHandle, Manager};

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("DB error: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("Path error: could not resolve app data directory")]
    PathError,
    #[error("{0}")]
    Validation(String),
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Library {
    pub id: String,
    pub name: String,
    pub description: String,
    pub color: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Document {
    pub id: String,
    pub library_id: String,
    pub document_type: String,
    pub title: String,
    pub authors: String,
    pub tags: Vec<String>,
    pub year: Option<i64>,
    pub abstract_text: Option<String>,
    pub doi: Option<String>,
    pub isbn: Option<String>,
    pub publisher: Option<String>,
    pub citation_key: Option<String>,
    pub source_path: Option<String>,
    pub imported_file_path: Option<String>,
    pub search_text: Option<String>,
    pub page_count: Option<i64>,
    pub has_ocr: bool,
    pub ocr_status: String,
    pub metadata_status: String,
    pub reading_stage: String,
    pub rating: i64,
    pub favorite: bool,
    pub last_opened_at: Option<String>,
    pub last_read_page: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: String,
    pub document_id: Option<String>,
    pub page_number: Option<i64>,
    pub location_hint: Option<String>,
    pub title: String,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Annotation {
    pub id: String,
    pub document_id: String,
    pub page_number: i64,
    pub kind: String,
    pub content: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateLibraryInput {
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateLibraryInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDocumentInput {
    pub id: Option<String>,
    pub library_id: String,
    pub document_type: Option<String>,
    pub title: String,
    pub authors: Option<String>,
    pub year: Option<i64>,
    pub abstract_text: Option<String>,
    pub doi: Option<String>,
    pub isbn: Option<String>,
    pub publisher: Option<String>,
    pub citation_key: Option<String>,
    pub source_path: Option<String>,
    pub imported_file_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDocumentInput {
    pub document_type: Option<String>,
    pub title: Option<String>,
    pub authors: Option<String>,
    pub search_text: Option<String>,
    pub year: Option<i64>,
    pub abstract_text: Option<String>,
    pub doi: Option<String>,
    pub isbn: Option<String>,
    pub publisher: Option<String>,
    pub citation_key: Option<String>,
    pub metadata_status: Option<String>,
    pub reading_stage: Option<String>,
    pub rating: Option<i64>,
    pub favorite: Option<bool>,
    pub has_ocr: Option<bool>,
    pub ocr_status: Option<String>,
    pub last_opened_at: Option<String>,
    pub last_read_page: Option<i64>,
    pub imported_file_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateNoteInput {
    pub document_id: Option<String>,
    pub page_number: Option<i64>,
    pub location_hint: Option<String>,
    pub title: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateNoteInput {
    pub page_number: Option<i64>,
    pub location_hint: Option<String>,
    pub title: Option<String>,
    pub content: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetSettingsInput {
    pub values: HashMap<String, String>,
}

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}

fn db_path(app: &AppHandle) -> Result<std::path::PathBuf, AppError> {
    let base = app.path().app_data_dir().map_err(|_| AppError::PathError)?;
    Ok(base.join("refx.db"))
}

fn open_db(app: &AppHandle) -> Result<Connection, AppError> {
    let path = db_path(app)?;
    let conn = Connection::open(path)?;
    conn.execute("PRAGMA foreign_keys = ON", [])?;
    Ok(conn)
}

fn ensure_column(conn: &Connection, table: &str, column: &str, definition: &str) -> Result<(), AppError> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({table})"))?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(1))?;
    let columns: Vec<String> = rows.filter_map(Result::ok).collect();
    if !columns.iter().any(|existing| existing == column) {
        conn.execute(&format!("ALTER TABLE {table} ADD COLUMN {column} {definition}"), [])?;
    }
    Ok(())
}

fn document_tags(conn: &Connection, document_id: &str) -> Result<Vec<String>, AppError> {
    let mut stmt = conn.prepare(
        r#"SELECT tags.name
           FROM tags
           INNER JOIN document_tags ON document_tags.tag_id = tags.id
           WHERE document_tags.document_id = ?1
           ORDER BY tags.name"#,
    )?;
    let rows = stmt.query_map(params![document_id], |row| row.get::<_, String>(0))?;
    Ok(rows.filter_map(Result::ok).collect())
}

fn get_library_by_id(conn: &Connection, id: &str) -> Result<Option<Library>, AppError> {
    let library = conn
        .query_row(
            "SELECT id, name, description, color, created_at, updated_at FROM libraries WHERE id = ?1",
            params![id],
            |r| {
                Ok(Library {
                    id: r.get(0)?,
                    name: r.get(1)?,
                    description: r.get(2)?,
                    color: r.get(3)?,
                    created_at: r.get(4)?,
                    updated_at: r.get(5)?,
                })
            },
        )
        .optional()?;
    Ok(library)
}

/// Get the application data directory path
#[tauri::command]
pub fn get_app_data_dir(app: AppHandle) -> Result<String, AppError> {
    let path = app.path().app_data_dir().map_err(|_| AppError::PathError)?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn ensure_app_directories(app: AppHandle) -> Result<(), AppError> {
    setup_app_directories(&app).await
}

#[tauri::command]
pub fn generate_document_id() -> String {
    format!("doc-{}", uuid::Uuid::new_v4())
}

pub async fn setup_app_directories(app: &AppHandle) -> Result<(), AppError> {
    let base_path = app.path().app_data_dir().map_err(|_| AppError::PathError)?;

    for dir in [
        base_path.clone(),
        base_path.join("pdfs"),
        base_path.join("thumbnails"),
        base_path.join("exports"),
        base_path.join("backups"),
    ] {
        if !dir.exists() {
            std::fs::create_dir_all(dir)?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn initialize_database(app: AppHandle) -> Result<(), AppError> {
    let conn = open_db(&app)?;

    conn.execute_batch(
        r#"
CREATE TABLE IF NOT EXISTS libraries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  color TEXT DEFAULT '#3b82f6',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  library_id TEXT NOT NULL,
  title TEXT NOT NULL,
  authors TEXT DEFAULT '[]',
  year INTEGER,
  abstract TEXT,
  doi TEXT,
  citation_key TEXT,
  source_path TEXT,
  imported_file_path TEXT,
  search_text TEXT,
  page_count INTEGER,
  has_ocr INTEGER DEFAULT 0,
  ocr_status TEXT DEFAULT 'pending',
  metadata_status TEXT DEFAULT 'incomplete',
  reading_stage TEXT DEFAULT 'unread',
  rating INTEGER DEFAULT 0,
  favorite INTEGER DEFAULT 0,
  last_opened_at TEXT,
  last_read_page INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (library_id) REFERENCES libraries(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#64748b',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS document_tags (
  document_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (document_id, tag_id),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS annotations (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  page_number INTEGER NOT NULL,
  kind TEXT NOT NULL,
  content TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  document_id TEXT,
  page_number INTEGER,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_documents_library_id ON documents(library_id);
CREATE INDEX IF NOT EXISTS idx_notes_document_id ON notes(document_id);
CREATE INDEX IF NOT EXISTS idx_annotations_document_id ON annotations(document_id);
        "#,
    )?;

    ensure_column(&conn, "documents", "search_text", "TEXT")?;
    ensure_column(&conn, "documents", "document_type", "TEXT NOT NULL DEFAULT 'pdf'")?;
    ensure_column(&conn, "documents", "isbn", "TEXT")?;
    ensure_column(&conn, "documents", "publisher", "TEXT")?;
    ensure_column(&conn, "notes", "page_number", "INTEGER")?;
    ensure_column(&conn, "notes", "location_hint", "TEXT")?;

    let count: i64 = conn.query_row("SELECT COUNT(*) FROM libraries", [], |r| r.get(0))?;
    if count == 0 {
        let now = now_iso();
        conn.execute(
            "INSERT INTO libraries (id, name, description, color, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params!["lib-default", "My Library", "Default local library", "#3b82f6", now, now],
        )?;
    }

    Ok(())
}

#[tauri::command]
pub fn list_libraries(app: AppHandle) -> Result<Vec<Library>, AppError> {
    let conn = open_db(&app)?;
    let mut stmt = conn.prepare("SELECT id, name, description, color, created_at, updated_at FROM libraries ORDER BY created_at")?;
    let rows = stmt.query_map([], |r| {
        Ok(Library {
            id: r.get(0)?,
            name: r.get(1)?,
            description: r.get(2)?,
            color: r.get(3)?,
            created_at: r.get(4)?,
            updated_at: r.get(5)?,
        })
    })?;
    Ok(rows.filter_map(Result::ok).collect())
}

#[tauri::command]
pub fn create_library(app: AppHandle, input: CreateLibraryInput) -> Result<Library, AppError> {
    let conn = open_db(&app)?;
    let id = format!("lib-{}", uuid::Uuid::new_v4());
    let now = now_iso();
    let name = input.name;
    let description = input.description.unwrap_or_default();
    let color = input.color.unwrap_or("#3b82f6".into());
    conn.execute(
        "INSERT INTO libraries (id, name, description, color, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, name, description, color, now, now],
    )?;
    Ok(Library {
        id,
        name,
        description,
        color,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
pub fn update_library(
    app: AppHandle,
    id: String,
    input: UpdateLibraryInput,
) -> Result<Option<Library>, AppError> {
    let conn = open_db(&app)?;
    let now = now_iso();
    conn.execute(
        r#"UPDATE libraries SET
          name = COALESCE(?1, name),
          description = COALESCE(?2, description),
          color = COALESCE(?3, color),
          updated_at = ?4
          WHERE id = ?5"#,
        params![input.name, input.description, input.color, now, id],
    )?;

    get_library_by_id(&conn, &id)
}

#[tauri::command]
pub fn delete_library(app: AppHandle, id: String) -> Result<bool, AppError> {
    let conn = open_db(&app)?;
    let library_count: i64 = conn.query_row("SELECT COUNT(*) FROM libraries", [], |r| r.get(0))?;
    if library_count <= 1 {
        return Err(AppError::Validation(
            "At least one library must remain.".to_string(),
        ));
    }

    let rows = conn.execute("DELETE FROM libraries WHERE id = ?1", params![id.clone()])?;
    if rows == 0 {
        return Ok(false);
    }

    let base_path = app.path().app_data_dir().map_err(|_| AppError::PathError)?;
    let library_dir = base_path.join("pdfs").join(id);
    if library_dir.exists() {
        std::fs::remove_dir_all(library_dir)?;
    }

    Ok(true)
}

#[tauri::command]
pub fn open_document_file_location(path: String) -> Result<(), AppError> {
    let target = std::path::PathBuf::from(&path);
    if !target.exists() {
        return Err(AppError::Validation(format!(
            "File not found: {}",
            target.to_string_lossy()
        )));
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(format!("/select,{}", target.to_string_lossy()))
            .spawn()?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open").arg("-R").arg(&target).spawn()?;
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let directory = target.parent().ok_or_else(|| {
            AppError::Validation("Could not resolve the parent directory.".to_string())
        })?;
        Command::new("xdg-open").arg(directory).spawn()?;
    }

    Ok(())
}

#[tauri::command]
pub fn list_documents_by_library(
    app: AppHandle,
    library_id: String,
) -> Result<Vec<Document>, AppError> {
    let conn = open_db(&app)?;
    let mut stmt = conn.prepare(r#"SELECT id, library_id, document_type, title, authors, year, abstract, doi, isbn, publisher, citation_key, source_path, imported_file_path, search_text, page_count, has_ocr, ocr_status, metadata_status, reading_stage, rating, favorite, last_opened_at, last_read_page, created_at, updated_at FROM documents WHERE library_id = ?1 ORDER BY updated_at DESC"#)?;
    let rows = stmt.query_map(params![library_id], map_document_row)?;
    let mut documents = Vec::new();
    for row in rows {
        let mut document = row?;
        document.tags = document_tags(&conn, &document.id)?;
        documents.push(document);
    }
    Ok(documents)
}

#[tauri::command]
pub fn list_all_documents(app: AppHandle) -> Result<Vec<Document>, AppError> {
    let conn = open_db(&app)?;
    let mut stmt = conn.prepare(r#"SELECT id, library_id, document_type, title, authors, year, abstract, doi, isbn, publisher, citation_key, source_path, imported_file_path, search_text, page_count, has_ocr, ocr_status, metadata_status, reading_stage, rating, favorite, last_opened_at, last_read_page, created_at, updated_at FROM documents ORDER BY updated_at DESC"#)?;
    let rows = stmt.query_map([], map_document_row)?;
    let mut documents = Vec::new();
    for row in rows {
        let mut document = row?;
        document.tags = document_tags(&conn, &document.id)?;
        documents.push(document);
    }
    Ok(documents)
}

#[tauri::command]
pub fn get_document_by_id(app: AppHandle, id: String) -> Result<Option<Document>, AppError> {
    let conn = open_db(&app)?;
    let mut stmt = conn.prepare(r#"SELECT id, library_id, document_type, title, authors, year, abstract, doi, isbn, publisher, citation_key, source_path, imported_file_path, search_text, page_count, has_ocr, ocr_status, metadata_status, reading_stage, rating, favorite, last_opened_at, last_read_page, created_at, updated_at FROM documents WHERE id = ?1"#)?;
    let doc = stmt.query_row(params![id], map_document_row).optional()?;
    match doc {
        Some(mut document) => {
            document.tags = document_tags(&conn, &document.id)?;
            Ok(Some(document))
        }
        None => Ok(None),
    }
}

fn map_document_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Document> {
    Ok(Document {
        id: row.get(0)?,
        library_id: row.get(1)?,
        document_type: row.get(2)?,
        title: row.get(3)?,
        authors: row.get(4)?,
        tags: Vec::new(),
        year: row.get(5)?,
        abstract_text: row.get(6)?,
        doi: row.get(7)?,
        isbn: row.get(8)?,
        publisher: row.get(9)?,
        citation_key: row.get(10)?,
        source_path: row.get(11)?,
        imported_file_path: row.get(12)?,
        search_text: row.get(13)?,
        page_count: row.get(14)?,
        has_ocr: row.get::<_, i64>(15)? == 1,
        ocr_status: row.get(16)?,
        metadata_status: row.get(17)?,
        reading_stage: row.get(18)?,
        rating: row.get(19)?,
        favorite: row.get::<_, i64>(20)? == 1,
        last_opened_at: row.get(21)?,
        last_read_page: row.get(22)?,
        created_at: row.get(23)?,
        updated_at: row.get(24)?,
    })
}

#[tauri::command]
pub fn create_document(app: AppHandle, input: CreateDocumentInput) -> Result<Document, AppError> {
    let conn = open_db(&app)?;
    let id = input
        .id
        .unwrap_or_else(|| format!("doc-{}", uuid::Uuid::new_v4()));
    let now = now_iso();
    conn.execute(
        r#"INSERT INTO documents (id, library_id, document_type, title, authors, year, abstract, doi, isbn, publisher, citation_key, source_path, imported_file_path, search_text, page_count, has_ocr, ocr_status, metadata_status, reading_stage, rating, favorite, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, NULL, NULL, 0, 'pending', 'incomplete', 'unread', 0, 0, ?14, ?14)"#,
        params![id, input.library_id, input.document_type.unwrap_or("pdf".into()), input.title, input.authors.unwrap_or("[]".into()), input.year, input.abstract_text, input.doi, input.isbn, input.publisher, input.citation_key, input.source_path, input.imported_file_path, now],
    )?;
    get_document_by_id(app, id)?.ok_or(rusqlite::Error::QueryReturnedNoRows.into())
}

#[tauri::command]
pub fn update_document_metadata(
    app: AppHandle,
    id: String,
    input: UpdateDocumentInput,
) -> Result<Option<Document>, AppError> {
    let conn = open_db(&app)?;
    let now = now_iso();
    conn.execute(
        r#"UPDATE documents SET
          title = COALESCE(?1, title),
          document_type = COALESCE(?2, document_type),
          authors = COALESCE(?3, authors),
          search_text = COALESCE(?4, search_text),
          year = COALESCE(?5, year),
          abstract = COALESCE(?6, abstract),
          doi = COALESCE(?7, doi),
          isbn = COALESCE(?8, isbn),
          publisher = COALESCE(?9, publisher),
          citation_key = COALESCE(?10, citation_key),
          metadata_status = COALESCE(?11, metadata_status),
          reading_stage = COALESCE(?12, reading_stage),
          rating = COALESCE(?13, rating),
          favorite = COALESCE(?14, favorite),
          has_ocr = COALESCE(?15, has_ocr),
          ocr_status = COALESCE(?16, ocr_status),
          last_opened_at = COALESCE(?17, last_opened_at),
          last_read_page = COALESCE(?18, last_read_page),
          imported_file_path = COALESCE(?19, imported_file_path),
          updated_at = ?20
          WHERE id = ?21"#,
        params![
            input.title,
            input.document_type,
            input.authors,
            input.search_text,
            input.year,
            input.abstract_text,
            input.doi,
            input.isbn,
            input.publisher,
            input.citation_key,
            input.metadata_status,
            input.reading_stage,
            input.rating,
            input.favorite.map(|b| if b { 1 } else { 0 }),
            input.has_ocr.map(|b| if b { 1 } else { 0 }),
            input.ocr_status,
            input.last_opened_at,
            input.last_read_page,
            input.imported_file_path,
            now,
            id
        ],
    )?;
    get_document_by_id(app, id)
}

#[tauri::command]
pub fn delete_document(app: AppHandle, id: String) -> Result<bool, AppError> {
    let conn = open_db(&app)?;
    let imported_file_path: Option<String> = conn
        .query_row(
            "SELECT imported_file_path FROM documents WHERE id = ?1",
            params![id.clone()],
            |r| r.get(0),
        )
        .optional()?
        .flatten();
    let rows = conn.execute("DELETE FROM documents WHERE id = ?1", params![id])?;
    if rows > 0 {
        if let Some(path) = imported_file_path {
            let local_file = std::path::PathBuf::from(path);
            if local_file.exists() {
                std::fs::remove_file(local_file)?;
            }
        }
    }
    Ok(rows > 0)
}

#[tauri::command]
pub fn add_tag_to_document(
    app: AppHandle,
    document_id: String,
    tag_name: String,
) -> Result<(), AppError> {
    let conn = open_db(&app)?;
    let existing: Option<String> = conn
        .query_row(
            "SELECT id FROM tags WHERE name = ?1",
            params![tag_name],
            |r| r.get(0),
        )
        .optional()?;
    let tag_id = match existing {
        Some(id) => id,
        None => {
            let generated_id = format!("tag-{}", uuid::Uuid::new_v4());
            conn.execute(
                "INSERT INTO tags (id, name, created_at) VALUES (?1, ?2, ?3)",
                params![generated_id, tag_name, now_iso()],
            )?;
            generated_id
        }
    };
    conn.execute(
        "INSERT OR IGNORE INTO document_tags (document_id, tag_id) VALUES (?1, ?2)",
        params![document_id, tag_id],
    )?;
    Ok(())
}

#[tauri::command]
pub fn remove_tag_from_document(
    app: AppHandle,
    document_id: String,
    tag_id: String,
) -> Result<(), AppError> {
    let conn = open_db(&app)?;
    conn.execute(
        "DELETE FROM document_tags WHERE document_id = ?1 AND tag_id = ?2",
        params![document_id, tag_id],
    )?;
    Ok(())
}

#[tauri::command]
pub fn list_annotations_for_document(
    app: AppHandle,
    document_id: String,
) -> Result<Vec<Annotation>, AppError> {
    let conn = open_db(&app)?;
    let mut stmt = conn.prepare("SELECT id, document_id, page_number, kind, content, created_at FROM annotations WHERE document_id = ?1 ORDER BY created_at DESC")?;
    let rows = stmt.query_map(params![document_id], |r| {
        Ok(Annotation {
            id: r.get(0)?,
            document_id: r.get(1)?,
            page_number: r.get(2)?,
            kind: r.get(3)?,
            content: r.get(4)?,
            created_at: r.get(5)?,
        })
    })?;
    Ok(rows.filter_map(Result::ok).collect())
}

#[tauri::command]
pub fn create_note(app: AppHandle, input: CreateNoteInput) -> Result<Note, AppError> {
    let conn = open_db(&app)?;
    let id = format!("note-{}", uuid::Uuid::new_v4());
    let now = now_iso();
    conn.execute(
        "INSERT INTO notes (id, document_id, page_number, location_hint, title, content, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![id, input.document_id, input.page_number, input.location_hint, input.title, input.content, now, now],
    )?;
    Ok(Note {
        id,
        document_id: input.document_id,
        page_number: input.page_number,
        location_hint: input.location_hint,
        title: input.title,
        content: input.content,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
pub fn update_note(
    app: AppHandle,
    id: String,
    input: UpdateNoteInput,
) -> Result<Option<Note>, AppError> {
    let conn = open_db(&app)?;
    let now = now_iso();
    conn.execute(
        r#"UPDATE notes SET
          page_number = COALESCE(?1, page_number),
          location_hint = COALESCE(?2, location_hint),
          title = COALESCE(?3, title),
          content = COALESCE(?4, content),
          updated_at = ?5
          WHERE id = ?6"#,
        params![input.page_number, input.location_hint, input.title, input.content, now, id],
    )?;

    let note = conn
        .query_row(
            "SELECT id, document_id, page_number, location_hint, title, content, created_at, updated_at FROM notes WHERE id = ?1",
            params![id],
            |r| {
                Ok(Note {
                    id: r.get(0)?,
                    document_id: r.get(1)?,
                    page_number: r.get(2)?,
                    location_hint: r.get(3)?,
                    title: r.get(4)?,
                    content: r.get(5)?,
                    created_at: r.get(6)?,
                    updated_at: r.get(7)?,
                })
            },
        )
        .optional()?;

    Ok(note)
}

#[tauri::command]
pub fn list_notes(app: AppHandle) -> Result<Vec<Note>, AppError> {
    let conn = open_db(&app)?;
    let mut stmt = conn.prepare("SELECT id, document_id, page_number, location_hint, title, content, created_at, updated_at FROM notes ORDER BY updated_at DESC")?;
    let rows = stmt.query_map([], |r| {
        Ok(Note {
            id: r.get(0)?,
            document_id: r.get(1)?,
            page_number: r.get(2)?,
            location_hint: r.get(3)?,
            title: r.get(4)?,
            content: r.get(5)?,
            created_at: r.get(6)?,
            updated_at: r.get(7)?,
        })
    })?;
    Ok(rows.filter_map(Result::ok).collect())
}

#[tauri::command]
pub fn delete_note(app: AppHandle, id: String) -> Result<bool, AppError> {
    let conn = open_db(&app)?;
    let rows = conn.execute("DELETE FROM notes WHERE id = ?1", params![id])?;
    Ok(rows > 0)
}

#[tauri::command]
pub fn get_settings(app: AppHandle) -> Result<HashMap<String, String>, AppError> {
    let conn = open_db(&app)?;
    let mut stmt = conn.prepare("SELECT key, value FROM settings ORDER BY key")?;
    let rows = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?;
    let mut settings = HashMap::new();
    for row in rows {
        let (key, value) = row?;
        settings.insert(key, value);
    }
    Ok(settings)
}

#[tauri::command]
pub fn set_settings(app: AppHandle, input: SetSettingsInput) -> Result<(), AppError> {
    let conn = open_db(&app)?;
    let now = now_iso();

    for (key, value) in input.values {
        conn.execute(
            r#"INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3)
               ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"#,
            params![key, value, now],
        )?;
    }

    Ok(())
}

#[tauri::command]
pub fn clear_local_data(app: AppHandle) -> Result<(), AppError> {
    let conn = open_db(&app)?;
    conn.execute("DELETE FROM document_tags", [])?;
    conn.execute("DELETE FROM annotations", [])?;
    conn.execute("DELETE FROM notes", [])?;
    conn.execute("DELETE FROM tags", [])?;
    conn.execute("DELETE FROM documents", [])?;
    conn.execute("DELETE FROM libraries", [])?;

    let base_path = app.path().app_data_dir().map_err(|_| AppError::PathError)?;
    for dir_name in ["pdfs", "thumbnails", "exports", "backups"] {
        let dir = base_path.join(dir_name);
        if dir.exists() {
            std::fs::remove_dir_all(&dir)?;
        }
        std::fs::create_dir_all(&dir)?;
    }

    let now = now_iso();
    conn.execute(
        "INSERT INTO libraries (id, name, description, color, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params!["lib-default", "My Library", "Default local library", "#3b82f6", now, now],
    )?;

    Ok(())
}
