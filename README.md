# Conlang Engine Backup REST API
This is an obsidian plugin to enable auto-backing up of ConlangEngine export files and then auto-loading them too.

**IMPORTANT**: Please note this is a desktop only plugin since mobile usage is unstable for web servers running in the background. If I ever get mobile to work properly I will update the functionality.

## Install to obsidian
### Downloading
Please checkout the project to your `<vault path>/.obsidian/plugins` folder. You should end up with a folder named `<vault path>/.obsidian/plugins/Conlang-Engine-Obsidian-Backup`.

This can be achieved by either download the zip from the releases tab (or downloading the latest changes as a zip), or via `git` commands:
```bash
# cd into your obsidian vaults plugins directory
cd /path/to/your/vault/.obsidian/plugins

# Clone the repo and cd into it
git clone https://github.com/niruhsa/ConlangEngine-Obsidian-Backup
cd ConlangEngine-Obsidian-Backup

# Checkout the latest release tag (e.g. v0.1.0)
git checkout $(git describe --tags git rev-list --tags --max-count=1)
```
### Enabling in Obsidian
In your obsidian vault, go to `Settings` -> `Community Plugins` and under `Installed Plugins` there should be a new plugin called `Conlang Engine Backup`, enable it and click on the settings icon for it.

There are a few settings:
#### API Port
This is the API port that the Conlang Engine website connects to for backup functionality - leave as default if you do not know anything about this.

#### Server Controls
If you are experiencing issues, you can Start/Stop/Restart the API server with these controls - leave alone if you do not know anything about this.

#### Test Connection
Simple functionality to test the API server is up and running from within obsidian for debugging purposes.

#### Backup Directory (Important)
This is where you set the folder in your vault that you want the plugin to save your backups to, for me personally I save them in `.conlang-backups`, that way they do not appear in obsidian since it has a `.` prefix on the folder, but the plugin is still able to access them.

You can sync these files using Obsidian Sync or a third-party syncing implementation (such as Syncthing) to sync between your devices.

#### Max backups to keep
The maximum amount of backed up versions to keep, defaults to 0 which is unlimited. Unless you are EXTREMELY low on storage (and each project only use kilobytes of storage without typeface data), I recommend leaving this as default and purging the versions every now and then by setting this option to a number like 100, then putting it back to 0.

This option will ONLY keep the latest X versions if set to anything other than 100.

## Overview - Developer information
Local HTTP API server for backing up and restoring Conlang Engine projects. Ships as an Obsidian plugin but the API is standalone — implement client in any app (web, mobile, CLI).

Server is an embedded Node.js HTTP server bound to `127.0.0.1` only. Stores backups as JSON files on disk under a configurable directory.

## Base URL

```
http://localhost:{port}
```

Default port: `3000`. Configurable in plugin settings (range 1024-65535).

## Data Model

### Backup Payload (`BackupPayload`)

Entire body is a JSON object with three top-level keys:

```typescript
{
  config: ConfigData;    // Full conlang configuration
  project: ProjectData;  // Local projects archive (contains config + dictionary copies)
  lexicon: LexiconData;  // Full lexicon (word list)
}
```

### ConfigData

Full conlang project configuration. Mapped from Conlang Engine's `useConfigStore` Zustand store. Key fields:

| Field | Type | Description |
|-------|------|-------------|
| `projectId` | `string` | Unique project identifier (`local_{timestamp}`) |
| `conlangName` | `string` | Conlang name |
| `authorName` | `string` | Author name |
| `description` | `string` | Conlang description |
| `phonologyTypes` | `string` | `"syllabic"` or other |
| `isPublic` | `boolean` | Public visibility toggle |
| `conlangIcon` | `string` | Icon name |
| `alphabeticScript` | `string` | Script type (`"latin"`, etc.) |
| `featuralComponents` | `object` | Featural writing system details |
| `blockSettings` | `BlockSettings` | Syllable block layout config |
| `blockTemplates` | `BlockTemplate[]` | Syllable block templates |
| `syllabificationAlgorithm` | `string` | `"ltr"` or algorithm name |
| `syntaxOrder` | `string` | `"SVO"`, `"SOV"`, etc. |
| `adjectivePlacement` | `string` | `"pre-nominal"` or `"post-nominal"` |
| `adjectiveAgreement` | `boolean` | Adjective agreement toggle |
| `writingDirection` | `string` | `"ltr"`, `"rtl"`, `"vertical-rl"`, `"vertical-lr"` |
| `consonants` | `string` | Comma-separated consonant inventory |
| `vowels` | `string` | Comma-separated vowel inventory |
| `syllablePattern` | `string` | Syllable structure patterns |
| `otherPhonemes` | `string` | Additional phonemes |
| `otherPhonemeMapping` | `string` | Phoneme mapping |
| `enableToneAndStress` | `boolean` | Tone/stress system toggle |
| `skipSyllableValidation` | `boolean` | Skip syllabification validation |
| `historicalRules` | `string` | Historical sound change rules |
| `syllabaryMap` | `object` | Syllabary character mapping |
| `grammarRules` | `GrammarRule[]` | Inflection/derivation grammar rules |
| `verbMarker` | `string` | Verb marker affix |
| `cliticsRules` | `string` | Clitics rules |
| `personRules` | `PersonRule[]` | Person agreement rules |
| `wikiPages` | `object` | Wiki pages (key-value) |
| `streak` | `number` | Study streak count |
| `unlockedBadges` | `string[]` | Unlocked achievement badges |
| `activity` | `ActivityItem[]` | Recent activity log |
| `isProActive` | `boolean` | Pro subscription status |
| `lastStudyDate` | `string\|null` | Last study session date |
| `customFont` | `string\|null` | Custom font name |
| `theme` | `string` | UI theme name |
| `colors` | `ColorData` | Color scheme |
| `customGlyphs` | `object` | Custom glyph definitions |
| `puaCounter` | `number` | Private Use Area counter |
| `customFontBase64` | `string\|null` | Embedded custom font (data URI) |
| `isRehydrating` | `boolean` | Rehydration state |
| `numeralBase` | `number` | Numeral system base |
| `sentenceMaps` | `array` | Sentence mapping data |
| `generatorMarkers` | `GeneratorMarkers` | Word class markers |
| `customWordClasses` | `string[]` | User-defined word classes |
| `customTags` | `string[]` | User-defined tags |
| `autoReturnToLexicon` | `boolean` | Auto-navigate to lexicon after creation |
| `syllablePatternWeights` | `object` | Syllable pattern probability weights |
| `alphabetNames` | `object` | Alphabet letter names |
| `numberSystem` | `NumberSystem` | Full number system config |
| `azureTtsUseIpa` | `boolean` | Use IPA for Azure TTS |
| `numberMatrix` | `object` | Number matrix data |
| `numberDerivedRules` | `NumberDerivedRules` | Ordinal/fractional/multiplier rules |
| `timeSystemVocab` | `TimeSystemVocab` | Time unit vocabulary |
| `calendarSystem` | `CalendarSystem` | Calendar days/months/format |
| `vowelHarmonyMode` | `string` | Vowel harmony mode |
| `vowelHarmonySets` | `VowelHarmonySet[]` | Vowel harmony sets |
| `vowelHarmonyOverrideWordClasses` | `string[]` | Word classes exempt from harmony |
| `vowelHarmonyOverrideTags` | `string[]` | Tags exempt from harmony |
| `alphabetGlyphs` | `object` | Alphabet glyph mappings |
| `semanticMappings` | `object` | Semantic field mappings |
| `wordAssistConfig` | `WordAssistConfig` | Word assist configuration |
| `functionWords` | `FunctionWord[]` | Function words list |
| `stressRules` | `StressRule[]` | Stress rules |
| `toneRules` | `ToneRule[]` | Tone rules |
| `customCourse` | `CustomCourse[]` | Custom study courses |

### Sub-types

**BlockSettings:**
- `maxChars` — max characters per block
- `layoutTemplate` — visual layout ID
- `slotMapping` — slot names array

**GrammarRule:**
- `id`, `name`, `affix`, `appliesTo`, `condition`, `dependency`, `standalone`, `applyToPersons`, `gloss`

**PersonRule:**
- `id`, `person` (1st/2nd/3rd), `number` (S/P/C), `gender`, `freeForm`, `affix`, `appliesTo`

**GeneratorMarkers:**
- `noun`, `verb`, `adjective`, `adverb`, `pronoun`, `particle`

**NumberSystem:**
- `zero`, `digits`, `stems`, `powers`, `irregulars` (all `Record<string,string>`)
- `settings.fusion`, `settings.separator`, `settings.order`

**NumberDerivedRules:**
- `ordinal`, `fractional`, `multiplier` (all strings)

**TimeSystemVocab:**
- `second`, `minute`, `hour`, `day`, `week`, `month`, `year`

**CalendarSystem:**
- `daysOfWeek` (string[]), `months` (string[]), `dateFormat`, `yearOffset`

**VowelHarmonySet:**
- `name`, `vowels` (string[])

**WordAssistConfig:**
- `syntaxOrder`, `copulaBehavior`, `copulaReplacement`, `triggers` (WordAssistTrigger[])

**WordAssistTrigger:**
- `id`, `name`, `trigger`, `marker`, `type`, `position`, `priority`

**FunctionWord:**
- `id`, `word`, `wordClass`, optional `translation`, `definition`, `tags`

**StressRule:**
- `id`, `type`, `value`, optional `fallback`

**ToneRule:**
- `id`, `condition`, `value`

**CoursePhrase:**
- `id`, `conlang`, `english`

**CustomCourse:**
- `id`, `title`, `phrases` (CoursePhrase[])

**ColorData:**
- `bg`, `header`, `s1`, `s2`, `s3`, `s4`, `font`, `font2`, `accent`, `accent2`, `accent3`, `border`, `blur`, `glow`

**ActivityItem:**
- `text`, `time`

### LexiconData

```typescript
{
  lexicon: LexiconEntry[];
}
```

**LexiconEntry:**
| Field | Type | Description |
|-------|------|-------------|
| `id` | `number` | Unique entry ID |
| `word` | `string` | Conlang word |
| `ipa` | `string` | IPA transcription |
| `wordClass` | `string` | Part of speech |
| `translation` | `string` | English translation |
| `definition` | `string` | Definition |
| `tags` | `string[]` | Tags |
| `tagSource` | `string` (optional) | Tag source |
| `ideogram` | `string` | Ideogram/script representation |
| `personCategory` | `string` | Person category |
| `tone` | `string` (optional) | Tone marking |
| `stress` | `string` (optional) | Stress marking |
| `parentRootId` | `number\|null` | Parent root word ID (etymology) |
| `derivationRuleId` | `string\|null` | Derivation rule used |
| `inflectionOverrides` | `object` | Overrides for inflected forms |
| `srs` | `object` (optional) | Spaced repetition data |
| `createdAt` | `number` | Unix timestamp |

### ProjectData

```typescript
{
  localProjects: LocalProject[];
}
```

**LocalProject:**
- `id` — project identifier
- `project_data.config` — project config snapshot
- `project_data.dictionary` — project dictionary snapshot
- `updated_at` — last update timestamp

## Endpoints

### Health Check

```
GET /api/health
```

**Response** `200`:
```json
{
  "status": "ok",
  "timestamp": "2026-06-06T12:00:00.000Z"
}
```

---

### Create Backup

```
POST /api/backups/:projectId
```

Creates a new versioned backup for a project. Body is the full `BackupPayload`.

**Project ID validation:** If `body.config.projectId` exists and differs from URL `:projectId`, returns 409.

**Versioning:** Auto-assigned (`v1`, `v2`, ...). Newest version determined by scanning existing files.

**Request body:** `BackupPayload` (full JSON)

**Response** `201`:
```json
{
  "version": "v3",
  "timestamp": "2026-06-06T12:00:00.000Z"
}
```

**Error** `409` — Project ID mismatch:
```json
{
  "error": "Project ID mismatch: URL has \"proj_a\" but body has \"proj_b\""
}
```

**Error** `400` — Invalid JSON or empty body.

---

### Get Latest Backup

```
GET /api/backups/latest/:projectId
```

Returns the most recent backup payload for a project.

**Response** `200`: Full `BackupPayload` JSON body.

**Error** `404`:
```json
{
  "error": "No backups found"
}
```

---

### Get Backup by Version

```
GET /api/backups/:projectId/:version
```

Returns a specific version. Version format is `v{N}` (e.g., `v1`, `v3`).

**Response** `200`: Full `BackupPayload` JSON body.

**Error** `404`:
```json
{
  "error": "Backup v1 not found for project \"proj_id\""
}
```

---

### Update Backup (Overwrite)

```
PUT /api/backups/:projectId/:version
```

Overwrites an existing backup version with new data.

**Project ID validation:** Same as Create — `body.config.projectId` must match URL or be absent.

**Request body:** `BackupPayload` (full JSON)

**Response** `200`:
```json
{
  "version": "v1",
  "updated": true
}
```

**Error** `409` — Project ID mismatch.
**Error** `404` — Version not found.

---

### Delete Backup

```
DELETE /api/backups/:projectId/:version
```

Deletes a specific backup version file from disk.

**Response** `200`:
```json
{
  "deleted": "v2"
}
```

**Error** `404`:
```json
{
  "error": "Backup v2 not found"
}
```

---

### List All Projects

```
GET /api/projects
```

Returns all projects that have at least one backup. Sorted by most recent backup first.

**Response** `200`:
```json
{
  "projects": [
    {
      "projectId": "local_1780663146235",
      "conlangName": "My Conlang",
      "authorName": "Author",
      "description": "Description",
      "phonologyTypes": "syllabic",
      "conlangIcon": "Globe",
      "alphabeticScript": "latin",
      "lastBackupTime": "2026-06-06T12:00:00.000Z",
      "latestVersion": "v3",
      "totalBackups": 3,
      "totalSizeBytes": 45678,
      "backups": [
        {
          "version": "v3",
          "timestamp": "2026-06-06T12:00:00.000Z",
          "sizeBytes": 15234
        },
        {
          "version": "v2",
          "timestamp": "2026-06-06T11:00:00.000Z",
          "sizeBytes": 15100
        }
      ]
    }
  ]
}
```

---

### Get Single Project

```
GET /api/projects/:projectId
```

Returns project metadata and full backup list for one project.

**Response** `200` — Same shape as a single item from `/api/projects` response.

**Error** `404`:
```json
{
  "error": "Project \"proj_id\" not found"
}
```

## CORS

Server allows requests from:
- `http://localhost:5173` (Vite dev server)
- `https://localhost:5173`
- `http://conlangengine.vercel.app`
- `https://conlangengine.vercel.app`

All other origins get `Access-Control-Allow-Origin: *`. Preflight (`OPTIONS`) returns 204 with CORS headers.

CORS headers:
```
Access-Control-Allow-Origin: {matched origin or *}
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400
```

## Error Responses

All errors return JSON with an `error` key:

```json
{
  "error": "Human-readable error message"
}
```

HTTP status codes used:
- `200` — Success
- `201` — Created
- `204` — No content (CORS preflight)
- `400` — Bad request (invalid JSON, empty body)
- `404` — Not found
- `409` — Conflict (project ID mismatch)
- `500` — Internal server error

## Disk Storage

Backups stored under the vault's configured backup directory. Structure:

```
{backupDir}/
  {projectId}/
    v1.json
    v2.json
    ...
```

Default `backupDir`: `conlang-backups` (relative to vault root).

**Max backups enforcement:** If `maxBackups > 0`, oldest backups are deleted when creating new ones. `maxBackups: 0` means unlimited.

## Client Implementation Notes

1. **Base URL:** Construct from port config. Default `http://localhost:3000`.
2. **Headers:** Always send `Content-Type: application/json`.
3. **Backup payload** comes from export of the Conlang Engine web app. Client can either:
   - Read from file (the Obsidian plugin reads `current.json` from vault)
   - Accept direct POST from the web app
4. **Project ID** lives in `config.projectId`. Extract and use as URL path param.
5. **Version format:** Always `v{N}` (numeric, ascending). Parse by stripping `v` prefix.
6. **List-to-Create flow:** Call `GET /api/projects/:id` first to see existing backups, then `POST` to create new version.
7. **No authentication** by default. Plugin has an `apiKey` setting but it's not enforced server-side — implement own auth if needed.

## Security Considerations

- Server binds to `127.0.0.1` (localhost) only — not accessible from network.
- Writing direction and custom font values in backup payloads should be validated/allowlisted before rendering (prevents CSS injection).
- No request size limits — large glyph/font payloads could fill disk.

## Full TypeScript Types Reference

See `src/types.ts` in source for all type definitions. The full `BackupPayload` type is:

```typescript
type BackupPayload = {
  config: ConfigData;
  project: ProjectData;
  lexicon: LexiconData;
};
```

Where `ConfigData`, `ProjectData`, `LexiconData`, and all sub-types are defined in the [Data Model](#data-model) section above.
