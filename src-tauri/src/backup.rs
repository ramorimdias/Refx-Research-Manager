use crate::commands::{
    self, Annotation, AppError, Document, DocumentRelation, GraphView, GraphViewNodeLayout,
    Library, Note,
};
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

const BACKUP_FORMAT_VERSION: u32 = 2;
const AUTO_BACKUP_LAST_RUN_KEY: &str = "autoBackupLastRunAt";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBackupInput {
    pub scope: String,
    pub automatic: Option<bool>,
    pub output_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreBackupInput {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreBackupResult {
    pub safety_backup: BackupFileMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunScheduledBackupInput {
    pub scope: String,
    pub interval_days: i64,
    pub keep_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupFileMetadata {
    pub id: String,
    pub file_name: String,
    pub path: String,
    pub scope: String,
    pub created_at: String,
    pub file_size: i64,
    pub automatic: bool,
    pub document_count: i64,
    pub note_count: i64,
    pub relation_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BackupFileBlob {
    original_path: String,
    relative_path: String,
    data_base64: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BackupArchive {
    #[serde(default = "default_backup_format_version")]
    format_version: u32,
    #[serde(default)]
    app_version: Option<String>,
    #[serde(default)]
    backup_id: Option<String>,
    created_at: String,
    scope: String,
    automatic: bool,
    #[serde(default)]
    settings: Option<HashMap<String, String>>,
    #[serde(default)]
    libraries: Option<Vec<Library>>,
    #[serde(default)]
    documents: Option<Vec<Document>>,
    #[serde(default)]
    notes: Option<Vec<Note>>,
    #[serde(default)]
    annotations: Option<Vec<Annotation>>,
    #[serde(default)]
    relations: Option<Vec<DocumentRelation>>,
    #[serde(default)]
    graph_views: Option<Vec<GraphView>>,
    #[serde(default)]
    graph_view_node_layouts: Option<Vec<GraphViewNodeLayout>>,
    #[serde(default)]
    files: Option<Vec<BackupFileBlob>>,
}

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}

fn default_backup_format_version() -> u32 {
    BACKUP_FORMAT_VERSION
}

fn current_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

fn db_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    let base = app.path().app_data_dir().map_err(|_| AppError::PathError)?;
    Ok(base.join("refx.db"))
}

fn open_db(app: &AppHandle) -> Result<Connection, AppError> {
    let path = db_path(app)?;
    let conn = Connection::open(path)?;
    conn.execute("PRAGMA foreign_keys = ON", [])?;
    Ok(conn)
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    app.path().app_data_dir().map_err(|_| AppError::PathError)
}

fn backups_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    Ok(app_data_dir(app)?.join("backups"))
}

fn ensure_backup_directories(app: &AppHandle) -> Result<(), AppError> {
    let base_path = app_data_dir(app)?;
    for dir in [
        base_path.clone(),
        base_path.join("pdfs"),
        base_path.join("document-text"),
        base_path.join("search"),
        base_path.join("thumbnails"),
        base_path.join("exports"),
        base_path.join("backups"),
    ] {
        if !dir.exists() {
            fs::create_dir_all(dir)?;
        }
    }
    Ok(())
}

fn default_backup_file_name(scope: &str, automatic: bool) -> String {
    format!(
        "refx-{}-{}{}.refxbackup.json",
        scope,
        chrono::Local::now().format("%Y%m%d-%H%M%S"),
        if automatic { "-auto" } else { "" }
    )
}

fn normalize_scope(scope: &str) -> Result<&str, AppError> {
    match scope {
        "full" | "documents" | "settings" => Ok(scope),
        _ => Err(AppError::Validation(
            "Backup scope must be one of: full, documents, settings.".to_string(),
        )),
    }
}

fn read_settings(conn: &Connection) -> Result<HashMap<String, String>, AppError> {
    let mut stmt = conn.prepare("SELECT key, value FROM settings ORDER BY key")?;
    let rows = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?;
    let mut settings = HashMap::new();
    for row in rows {
        let (key, value) = row?;
        settings.insert(key, value);
    }
    Ok(settings)
}

fn set_setting_value(conn: &Connection, key: &str, value: &str) -> Result<(), AppError> {
    conn.execute(
        r#"INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"#,
        params![key, value, now_iso()],
    )?;
    Ok(())
}

fn get_setting_value(conn: &Connection, key: &str) -> Result<Option<String>, AppError> {
    conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        params![key],
        |row| row.get::<_, String>(0),
    )
    .optional()
    .map_err(AppError::from)
}

fn relative_backup_path(base_path: &Path, original_path: &str, fallback_dir: &str) -> String {
    let path = PathBuf::from(original_path);
    if let Ok(stripped) = path.strip_prefix(base_path) {
        return stripped.to_string_lossy().replace('\\', "/");
    }

    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("file.bin");
    format!("{fallback_dir}/{file_name}")
}

fn collect_backup_file_blobs(
    app: &AppHandle,
    documents: &[Document],
) -> Result<Vec<BackupFileBlob>, AppError> {
    let base_path = app_data_dir(app)?;
    let mut seen_paths = HashSet::new();
    let mut blobs = Vec::new();

    for document in documents {
        for (candidate, fallback_dir) in [
            (document.imported_file_path.as_deref(), "pdfs"),
            (document.extracted_text_path.as_deref(), "document-text"),
        ] {
            let Some(path) = candidate else {
                continue;
            };
            if !seen_paths.insert(path.to_string()) {
                continue;
            }
            let file_path = PathBuf::from(path);
            if !file_path.exists() {
                continue;
            }
            let bytes = fs::read(&file_path)?;
            blobs.push(BackupFileBlob {
                original_path: path.to_string(),
                relative_path: relative_backup_path(&base_path, path, fallback_dir),
                data_base64: BASE64_STANDARD.encode(bytes),
            });
        }
    }

    Ok(blobs)
}

fn list_all_relations(app: &AppHandle, libraries: &[Library]) -> Result<Vec<DocumentRelation>, AppError> {
    let mut relations = Vec::new();
    for library in libraries {
        relations.extend(commands::list_document_relations_for_library(
            app.clone(),
            library.id.clone(),
        )?);
    }
    Ok(relations)
}

fn list_all_graph_views(app: &AppHandle, libraries: &[Library]) -> Result<Vec<GraphView>, AppError> {
    let mut graph_views = Vec::new();
    for library in libraries {
        graph_views.extend(commands::list_graph_views(app.clone(), library.id.clone())?);
    }
    Ok(graph_views)
}

fn list_all_graph_view_layouts(
    app: &AppHandle,
    graph_views: &[GraphView],
) -> Result<Vec<GraphViewNodeLayout>, AppError> {
    let mut layouts = Vec::new();
    for graph_view in graph_views {
        layouts.extend(commands::list_graph_view_node_layouts(
            app.clone(),
            graph_view.id.clone(),
        )?);
    }
    Ok(layouts)
}

fn metadata_from_archive(path: &Path, archive: &BackupArchive) -> Result<BackupFileMetadata, AppError> {
    let metadata = fs::metadata(path)?;
    Ok(BackupFileMetadata {
        id: archive.backup_id.clone().unwrap_or_else(|| {
            path.file_stem()
                .and_then(|value| value.to_str())
                .unwrap_or_default()
                .to_string()
        }),
        file_name: path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("backup.refxbackup.json")
            .to_string(),
        path: path.to_string_lossy().to_string(),
        scope: archive.scope.clone(),
        created_at: archive.created_at.clone(),
        file_size: metadata.len() as i64,
        automatic: archive.automatic,
        document_count: archive.documents.as_ref().map(|items| items.len() as i64).unwrap_or(0),
        note_count: archive.notes.as_ref().map(|items| items.len() as i64).unwrap_or(0),
        relation_count: archive.relations.as_ref().map(|items| items.len() as i64).unwrap_or(0),
    })
}

fn prune_old_automatic_backups(app: &AppHandle, keep_count: i64) -> Result<(), AppError> {
    let keep_count = keep_count.clamp(1, 10) as usize;
    let mut automatic_backups = list_backups(app.clone())?
        .into_iter()
        .filter(|backup| backup.automatic)
        .collect::<Vec<_>>();
    automatic_backups.sort_by(|left, right| right.created_at.cmp(&left.created_at));

    for backup in automatic_backups.into_iter().skip(keep_count) {
        let path = PathBuf::from(backup.path);
        if path.exists() {
            fs::remove_file(path)?;
        }
    }

    Ok(())
}

fn backup_version_from_value(value: &Value) -> u32 {
    value
        .get("formatVersion")
        .and_then(|entry| entry.as_u64())
        .map(|entry| entry as u32)
        .unwrap_or(1)
}

fn value_object_mut<'a>(value: &'a mut Value) -> Result<&'a mut Map<String, Value>, AppError> {
    value.as_object_mut().ok_or_else(|| {
        AppError::Validation("Backup file is not a valid JSON object.".to_string())
    })
}

fn migrate_backup_v1_to_v2(mut value: Value) -> Result<Value, AppError> {
    let object = value_object_mut(&mut value)?;
    object.insert("formatVersion".to_string(), Value::from(2_u64));
    if !object.contains_key("appVersion") {
        object.insert("appVersion".to_string(), Value::from(current_app_version()));
    }
    if !object.contains_key("backupId") {
        object.insert(
            "backupId".to_string(),
            Value::from(format!("backup-{}", uuid::Uuid::new_v4())),
        );
    }
    Ok(value)
}

fn migrate_backup_value(mut value: Value) -> Result<Value, AppError> {
    let mut version = backup_version_from_value(&value);
    if version > BACKUP_FORMAT_VERSION {
        return Err(AppError::Validation(format!(
            "This backup uses format version {version}, but this app supports up to version {BACKUP_FORMAT_VERSION}.",
        )));
    }

    while version < BACKUP_FORMAT_VERSION {
        value = match version {
            1 => migrate_backup_v1_to_v2(value)?,
            _ => {
                return Err(AppError::Validation(format!(
                    "No migration path is available for backup format version {version}.",
                )))
            }
        };
        version = backup_version_from_value(&value);
    }

    Ok(value)
}

fn parse_backup_archive(raw: &str) -> Result<BackupArchive, AppError> {
    let raw_value: Value = serde_json::from_str(raw)
        .map_err(|error| AppError::Validation(format!("Could not parse backup file: {error}")))?;
    let migrated_value = migrate_backup_value(raw_value)?;
    let mut archive: BackupArchive = serde_json::from_value(migrated_value).map_err(|error| {
        AppError::Validation(format!("Could not decode backup archive contents: {error}"))
    })?;
    archive.format_version = BACKUP_FORMAT_VERSION;
    if archive.app_version.is_none() {
        archive.app_version = Some(current_app_version());
    }
    if archive.backup_id.is_none() {
        archive.backup_id = Some(format!("backup-{}", uuid::Uuid::new_v4()));
    }
    Ok(archive)
}

fn clear_document_domain(conn: &Connection, base_path: &Path) -> Result<(), AppError> {
    conn.execute("DELETE FROM document_tags", [])?;
    conn.execute("DELETE FROM graph_view_node_layouts", [])?;
    conn.execute("DELETE FROM graph_views", [])?;
    conn.execute("DELETE FROM document_relations", [])?;
    conn.execute("DELETE FROM annotations", [])?;
    conn.execute("DELETE FROM notes", [])?;
    conn.execute("DELETE FROM tags", [])?;
    conn.execute("DELETE FROM documents", [])?;
    conn.execute("DELETE FROM libraries", [])?;

    for dir_name in ["pdfs", "document-text", "search", "thumbnails", "exports"] {
        let dir = base_path.join(dir_name);
        if dir.exists() {
            fs::remove_dir_all(&dir)?;
        }
        fs::create_dir_all(&dir)?;
    }

    Ok(())
}

fn restore_file_blobs(
    base_path: &Path,
    blobs: &[BackupFileBlob],
) -> Result<HashMap<String, String>, AppError> {
    let mut restored_paths = HashMap::new();

    for blob in blobs {
        let target_path = base_path.join(PathBuf::from(&blob.relative_path));
        if let Some(parent) = target_path.parent() {
            fs::create_dir_all(parent)?;
        }
        let bytes = BASE64_STANDARD
            .decode(&blob.data_base64)
            .map_err(|error| AppError::Validation(format!("Could not decode backup file data: {error}")))?;
        fs::write(&target_path, bytes)?;
        restored_paths.insert(
            blob.original_path.clone(),
            target_path.to_string_lossy().to_string(),
        );
    }

    Ok(restored_paths)
}

fn insert_library(conn: &Connection, library: &Library) -> Result<(), AppError> {
    conn.execute(
        "INSERT INTO libraries (id, name, description, color, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            library.id,
            library.name,
            library.description,
            library.color,
            library.created_at,
            library.updated_at,
        ],
    )?;
    Ok(())
}

fn insert_document(conn: &Connection, document: &Document) -> Result<(), AppError> {
    conn.execute(
        r#"INSERT INTO documents (
          id, library_id, document_type, title, authors, year, abstract, doi, isbn, publisher, citation_key,
          source_path, imported_file_path, extracted_text_path, search_text, text_hash, text_extracted_at,
          text_extraction_status, page_count, has_extracted_text, has_ocr, has_ocr_text, ocr_status,
          metadata_status, metadata_provenance, metadata_user_edited_fields, indexing_status, tag_suggestions,
          rejected_tag_suggestions, tag_suggestion_text_hash, tag_suggestion_status, classification_result,
          classification_text_hash, classification_status, processing_error, processing_updated_at,
          last_processed_at, reading_stage, rating, favorite, last_opened_at, last_read_page, commentary_text,
          commentary_updated_at, created_at, updated_at
        ) VALUES (
          ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11,
          ?12, ?13, ?14, ?15, ?16, ?17,
          ?18, ?19, ?20, ?21, ?22, ?23,
          ?24, ?25, ?26, ?27, ?28,
          ?29, ?30, ?31, ?32,
          ?33, ?34, ?35, ?36,
          ?37, ?38, ?39, ?40, ?41, ?42, ?43,
          ?44, ?45, ?46
        )"#,
        params![
            document.id,
            document.library_id,
            document.document_type,
            document.title,
            document.authors,
            document.year,
            document.abstract_text,
            document.doi,
            document.isbn,
            document.publisher,
            document.citation_key,
            document.source_path,
            document.imported_file_path,
            document.extracted_text_path,
            document.search_text,
            document.text_hash,
            document.text_extracted_at,
            document.text_extraction_status,
            document.page_count,
            if document.has_extracted_text { 1 } else { 0 },
            if document.has_ocr { 1 } else { 0 },
            if document.has_ocr_text { 1 } else { 0 },
            document.ocr_status,
            document.metadata_status,
            document.metadata_provenance,
            document.metadata_user_edited_fields,
            document.indexing_status,
            document.tag_suggestions,
            document.rejected_tag_suggestions,
            document.tag_suggestion_text_hash,
            document.tag_suggestion_status,
            document.classification_result,
            document.classification_text_hash,
            document.classification_status,
            document.processing_error,
            document.processing_updated_at,
            document.last_processed_at,
            document.reading_stage,
            document.rating,
            if document.favorite { 1 } else { 0 },
            document.last_opened_at,
            document.last_read_page,
            document.commentary_text,
            document.commentary_updated_at,
            document.created_at,
            document.updated_at,
        ],
    )?;
    Ok(())
}

fn insert_tags_for_document(
    conn: &Connection,
    document_id: &str,
    tags: &[String],
    tag_ids: &mut HashMap<String, String>,
) -> Result<(), AppError> {
    for tag_name in tags {
        let tag_id = if let Some(existing) = tag_ids.get(tag_name) {
            existing.clone()
        } else {
            let new_id = format!("tag-{}", uuid::Uuid::new_v4());
            conn.execute(
                "INSERT INTO tags (id, name, created_at) VALUES (?1, ?2, ?3)",
                params![new_id, tag_name, now_iso()],
            )?;
            tag_ids.insert(tag_name.clone(), new_id.clone());
            new_id
        };

        conn.execute(
            "INSERT OR IGNORE INTO document_tags (document_id, tag_id) VALUES (?1, ?2)",
            params![document_id, tag_id],
        )?;
    }

    Ok(())
}

fn insert_note(conn: &Connection, note: &Note) -> Result<(), AppError> {
    conn.execute(
        "INSERT INTO notes (id, document_id, page_number, location_hint, comment_number, position_x, position_y, title, content, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            note.id,
            note.document_id,
            note.page_number,
            note.location_hint,
            note.comment_number,
            note.position_x,
            note.position_y,
            note.title,
            note.content,
            note.created_at,
            note.updated_at,
        ],
    )?;
    Ok(())
}

fn insert_annotation(conn: &Connection, annotation: &Annotation) -> Result<(), AppError> {
    conn.execute(
        "INSERT INTO annotations (id, document_id, page_number, kind, content, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            annotation.id,
            annotation.document_id,
            annotation.page_number,
            annotation.kind,
            annotation.content,
            annotation.created_at,
        ],
    )?;
    Ok(())
}

fn insert_relation(conn: &Connection, relation: &DocumentRelation) -> Result<(), AppError> {
    conn.execute(
        r#"INSERT INTO document_relations (
          id, source_document_id, target_document_id, link_type, link_origin, relation_status, confidence,
          label, notes, match_method, raw_reference_text, normalized_reference_text, normalized_title,
          normalized_first_author, reference_index, parse_confidence, parse_warnings, match_debug_info,
          created_at, updated_at
        ) VALUES (
          ?1, ?2, ?3, ?4, ?5, ?6, ?7,
          ?8, ?9, ?10, ?11, ?12, ?13,
          ?14, ?15, ?16, ?17, ?18,
          ?19, ?20
        )"#,
        params![
            relation.id,
            relation.source_document_id,
            relation.target_document_id,
            relation.link_type,
            relation.link_origin,
            relation.relation_status,
            relation.confidence,
            relation.label,
            relation.notes,
            relation.match_method,
            relation.raw_reference_text,
            relation.normalized_reference_text,
            relation.normalized_title,
            relation.normalized_first_author,
            relation.reference_index,
            relation.parse_confidence,
            relation.parse_warnings,
            relation.match_debug_info,
            relation.created_at,
            relation.updated_at,
        ],
    )?;
    Ok(())
}

fn insert_graph_view(conn: &Connection, graph_view: &GraphView) -> Result<(), AppError> {
    conn.execute(
        r#"INSERT INTO graph_views (
          id, library_id, name, description, relation_filter, color_mode, size_mode, scope_mode,
          neighborhood_depth, focus_mode, hide_orphans, confidence_threshold, year_min, year_max,
          selected_document_id, document_ids_json, created_at, updated_at
        ) VALUES (
          ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8,
          ?9, ?10, ?11, ?12, ?13, ?14,
          ?15, ?16, ?17, ?18
        )"#,
        params![
            graph_view.id,
            graph_view.library_id,
            graph_view.name,
            graph_view.description,
            graph_view.relation_filter,
            graph_view.color_mode,
            graph_view.size_mode,
            graph_view.scope_mode,
            graph_view.neighborhood_depth,
            if graph_view.focus_mode { 1 } else { 0 },
            if graph_view.hide_orphans { 1 } else { 0 },
            graph_view.confidence_threshold,
            graph_view.year_min,
            graph_view.year_max,
            graph_view.selected_document_id,
            graph_view.document_ids_json,
            graph_view.created_at,
            graph_view.updated_at,
        ],
    )?;
    Ok(())
}

fn insert_graph_view_node_layout(
    conn: &Connection,
    layout: &GraphViewNodeLayout,
) -> Result<(), AppError> {
    conn.execute(
        r#"INSERT INTO graph_view_node_layouts (
          graph_view_id, document_id, position_x, position_y, pinned, hidden, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"#,
        params![
            layout.graph_view_id,
            layout.document_id,
            layout.position_x,
            layout.position_y,
            if layout.pinned { 1 } else { 0 },
            if layout.hidden { 1 } else { 0 },
            layout.updated_at,
        ],
    )?;
    Ok(())
}

#[tauri::command]
pub fn create_backup(
    app: AppHandle,
    input: CreateBackupInput,
) -> Result<BackupFileMetadata, AppError> {
    let scope = normalize_scope(&input.scope)?.to_string();
    ensure_backup_directories(&app)?;
    let conn = open_db(&app)?;
    let libraries = if scope == "full" || scope == "documents" {
        commands::list_libraries(app.clone())?
    } else {
        Vec::new()
    };
    let documents = if scope == "full" || scope == "documents" {
        commands::list_all_documents(app.clone())?
    } else {
        Vec::new()
    };
    let notes = if scope == "full" || scope == "documents" {
        commands::list_notes(app.clone())?
    } else {
        Vec::new()
    };
    let annotations = if scope == "full" || scope == "documents" {
        commands::list_all_annotations(app.clone())?
    } else {
        Vec::new()
    };
    let relations = if scope == "full" || scope == "documents" {
        list_all_relations(&app, &libraries)?
    } else {
        Vec::new()
    };
    let graph_views = if scope == "full" || scope == "documents" {
        list_all_graph_views(&app, &libraries)?
    } else {
        Vec::new()
    };
    let graph_view_node_layouts = if scope == "full" || scope == "documents" {
        list_all_graph_view_layouts(&app, &graph_views)?
    } else {
        Vec::new()
    };
    let settings = if scope == "full" || scope == "settings" {
        read_settings(&conn)?
    } else {
        HashMap::new()
    };
    let files = if scope == "full" || scope == "documents" {
        collect_backup_file_blobs(&app, &documents)?
    } else {
        Vec::new()
    };

    let archive = BackupArchive {
        format_version: BACKUP_FORMAT_VERSION,
        app_version: Some(current_app_version()),
        backup_id: Some(format!("backup-{}", uuid::Uuid::new_v4())),
        created_at: now_iso(),
        scope: scope.clone(),
        automatic: input.automatic.unwrap_or(false),
        settings: if settings.is_empty() { None } else { Some(settings) },
        libraries: if libraries.is_empty() { None } else { Some(libraries) },
        documents: if documents.is_empty() { None } else { Some(documents) },
        notes: if notes.is_empty() { None } else { Some(notes) },
        annotations: if annotations.is_empty() { None } else { Some(annotations) },
        relations: if relations.is_empty() { None } else { Some(relations) },
        graph_views: if graph_views.is_empty() { None } else { Some(graph_views) },
        graph_view_node_layouts: if graph_view_node_layouts.is_empty() {
            None
        } else {
            Some(graph_view_node_layouts)
        },
        files: if files.is_empty() { None } else { Some(files) },
    };

    let backup_path = if let Some(output_path) = input.output_path.as_deref() {
        PathBuf::from(output_path)
    } else {
        backups_dir(&app)?.join(default_backup_file_name(&scope, archive.automatic))
    };
    if let Some(parent) = backup_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)?;
        }
    }
    let payload = serde_json::to_string_pretty(&archive)
        .map_err(|error| AppError::Validation(format!("Could not serialize backup: {error}")))?;
    fs::write(&backup_path, payload)?;

    metadata_from_archive(&backup_path, &archive)
}

#[tauri::command]
pub fn list_backups(app: AppHandle) -> Result<Vec<BackupFileMetadata>, AppError> {
    ensure_backup_directories(&app)?;
    let dir = backups_dir(&app)?;
    let mut backups = Vec::new();

    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let file_name = path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_string();
        if !file_name.ends_with(".refxbackup.json") {
            continue;
        }
        let raw = fs::read_to_string(&path)?;
        let archive = parse_backup_archive(&raw)?;
        backups.push(metadata_from_archive(&path, &archive)?);
    }

    backups.sort_by(|left, right| right.created_at.cmp(&left.created_at));
    Ok(backups)
}

#[tauri::command]
pub fn delete_backup(path: String) -> Result<bool, AppError> {
    let backup_path = PathBuf::from(path);
    if !backup_path.exists() {
        return Ok(false);
    }
    fs::remove_file(backup_path)?;
    Ok(true)
}

#[tauri::command]
pub fn restore_backup(
    app: AppHandle,
    input: RestoreBackupInput,
) -> Result<RestoreBackupResult, AppError> {
    ensure_backup_directories(&app)?;
    let raw = fs::read_to_string(&input.path)?;
    let archive = parse_backup_archive(&raw)?;
    let safety_backup_path = backups_dir(&app)?.join(format!(
        "refx-pre-restore-{}-{}.refxbackup.json",
        archive.scope,
        chrono::Local::now().format("%Y%m%d-%H%M%S")
    ));
    create_backup(
        app.clone(),
        CreateBackupInput {
            scope: "full".to_string(),
            automatic: Some(true),
            output_path: Some(safety_backup_path.to_string_lossy().to_string()),
        },
    )?;

    let base_path = app_data_dir(&app)?;
    let mut conn = open_db(&app)?;
    let tx = conn.transaction()?;

    if archive.scope == "full" || archive.scope == "documents" {
        clear_document_domain(&tx, &base_path)?;

        let restored_file_paths = restore_file_blobs(
            &base_path,
            archive.files.as_deref().unwrap_or(&[]),
        )?;

        for library in archive.libraries.as_deref().unwrap_or(&[]) {
            insert_library(&tx, library)?;
        }

        let mut tag_ids = HashMap::new();
        for document in archive.documents.as_deref().unwrap_or(&[]) {
            let mut restored_document = document.clone();

            if let Some(imported_path) = restored_document.imported_file_path.clone() {
                if let Some(restored_path) = restored_file_paths.get(&imported_path) {
                    restored_document.imported_file_path = Some(restored_path.clone());
                    if restored_document.source_path.as_deref() == Some(imported_path.as_str()) {
                        restored_document.source_path = Some(restored_path.clone());
                    }
                }
            }

            if let Some(extracted_path) = restored_document.extracted_text_path.clone() {
                if let Some(restored_path) = restored_file_paths.get(&extracted_path) {
                    restored_document.extracted_text_path = Some(restored_path.clone());
                }
            }

            insert_document(&tx, &restored_document)?;
            insert_tags_for_document(
                &tx,
                &restored_document.id,
                &restored_document.tags,
                &mut tag_ids,
            )?;
        }

        for note in archive.notes.as_deref().unwrap_or(&[]) {
            insert_note(&tx, note)?;
        }
        for annotation in archive.annotations.as_deref().unwrap_or(&[]) {
            insert_annotation(&tx, annotation)?;
        }
        for relation in archive.relations.as_deref().unwrap_or(&[]) {
            insert_relation(&tx, relation)?;
        }
        for graph_view in archive.graph_views.as_deref().unwrap_or(&[]) {
            insert_graph_view(&tx, graph_view)?;
        }
        for layout in archive.graph_view_node_layouts.as_deref().unwrap_or(&[]) {
            insert_graph_view_node_layout(&tx, layout)?;
        }
    }

    if archive.scope == "full" || archive.scope == "settings" {
        tx.execute("DELETE FROM settings", [])?;
        for (key, value) in archive.settings.as_ref().unwrap_or(&HashMap::new()) {
            tx.execute(
                "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3)",
                params![key, value, now_iso()],
            )?;
        }
    }

    tx.commit()?;
    let safety_backup = metadata_from_archive(
        &safety_backup_path,
        &parse_backup_archive(&fs::read_to_string(&safety_backup_path)?)?,
    )?;
    Ok(RestoreBackupResult { safety_backup })
}

#[tauri::command]
pub fn run_scheduled_backup_if_due(
    app: AppHandle,
    input: RunScheduledBackupInput,
) -> Result<Option<BackupFileMetadata>, AppError> {
    let scope = normalize_scope(&input.scope)?;
    if input.interval_days <= 0 {
        return Err(AppError::Validation(
            "Automatic backup interval must be at least 1 day.".to_string(),
        ));
    }
    if input.keep_count <= 0 || input.keep_count > 10 {
        return Err(AppError::Validation(
            "Automatic backup retention must be between 1 and 10 backups.".to_string(),
        ));
    }

    let conn = open_db(&app)?;
    if let Some(last_run_raw) = get_setting_value(&conn, AUTO_BACKUP_LAST_RUN_KEY)? {
        if let Ok(last_run) = chrono::DateTime::parse_from_rfc3339(&last_run_raw) {
            let next_due = last_run + chrono::Duration::days(input.interval_days);
            if chrono::Utc::now() < next_due.with_timezone(&chrono::Utc) {
                return Ok(None);
            }
        }
    }

    let backup = create_backup(
        app.clone(),
        CreateBackupInput {
            scope: scope.to_string(),
            automatic: Some(true),
            output_path: None,
        },
    )?;
    set_setting_value(&conn, AUTO_BACKUP_LAST_RUN_KEY, &now_iso())?;
    prune_old_automatic_backups(&app, input.keep_count)?;
    Ok(Some(backup))
}
