import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

const MIME_JSON = 'application/json; charset=utf-8';

const CORS_ORIGINS = [
	'http://localhost:5173',
	'https://localhost:5173',
	'http://conlangengine.vercel.app',
	'https://conlangengine.vercel.app',
];

interface BackupMeta {
	version: string;
	timestamp: string;
}

/** Simple embedded HTTP server for backup REST API. */
export class BackupApiServer {
	private server: http.Server | null = null;
	private port: number;
	private dataDir: string;
	private maxBackups: number;
	private _lastError: string | null = null;

	constructor(port: number, storageDir: string, maxBackups: number) {
		this.port = port;
		this.dataDir = storageDir;
		this.maxBackups = maxBackups;
	}

	get isRunning(): boolean {
		return this.server !== null && this.server.listening;
	}

	get lastError(): string | null {
		return this._lastError;
	}

	private corsHeaders(origin?: string): Record<string, string> {
		const allowOrigin = origin && CORS_ORIGINS.includes(origin)
			? origin
			: '*';
		return {
			'Access-Control-Allow-Origin': allowOrigin,
			'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization',
			'Access-Control-Max-Age': '86400',
		};
	}

	start(): Promise<void> {
		return new Promise((resolve, reject) => {
			if (this.isRunning) {
				resolve();
				return;
			}

			// Ensure data directory exists
			try {
				fs.mkdirSync(this.dataDir, { recursive: true });
			} catch {
				// ignore
			}

			this.server = http.createServer((req, res) =>
				this.handleRequest(req, res),
			);

			this.server.on('error', (err: NodeJS.ErrnoException) => {
				this._lastError = err.message;
				reject(err);
			});

			this.server.listen(this.port, '127.0.0.1', () => {
				this._lastError = null;
				// Enforce retention on startup so the configured limit applies
				// to backups created in prior sessions.
				this.enforceMaxBackupsAll();
				resolve();
			});
		});
	}

	stop(): Promise<void> {
		return new Promise((resolve) => {
			if (!this.server) {
				resolve();
				return;
			}
			this.server.close(() => {
				this.server = null;
				resolve();
			});
		});
	}

	restart(): Promise<void> {
		return this.stop().then(() => this.start());
	}

	updateConfig(port: number, maxBackups: number): void {
		const needsRestart = port !== this.port;
		const maxChanged = maxBackups !== this.maxBackups;
		this.port = port;
		this.maxBackups = maxBackups;
		if (needsRestart && this.isRunning) {
			void this.restart();
		}
		// Re-enforce retention immediately when the limit changes so the
		// running server reflects the new setting without a restart.
		if (maxChanged) {
			this.enforceMaxBackupsAll();
		}
	}

	/** List all project IDs (subdirectories) under the data dir. */
	private listProjectIds(): string[] {
		let entries: string[];
		try {
			entries = fs.readdirSync(this.dataDir);
		} catch {
			return [];
		}

		const ids: string[] = [];
		for (const entry of entries) {
			try {
				if (fs.statSync(path.join(this.dataDir, entry)).isDirectory()) {
					ids.push(entry);
				}
			} catch {
				// skip unreadable
			}
		}
		return ids;
	}

	/** Enforce the max-backups limit across every project on disk. */
	enforceMaxBackupsAll(): void {
		if (this.maxBackups <= 0) return;
		for (const projectId of this.listProjectIds()) {
			this.enforceMaxBackups(projectId);
		}
	}

	private respond(
		res: http.ServerResponse,
		status: number,
		data: unknown,
		origin?: string,
	): void {
		const cors = this.corsHeaders(origin);
		res.writeHead(status, {
			'Content-Type': MIME_JSON,
			...cors,
		});
		res.end(JSON.stringify(data));
	}

	private parseBody(req: http.IncomingMessage): Promise<unknown> {
		return new Promise((resolve, reject) => {
			const chunks: Buffer[] = [];
			req.on('data', (chunk: Buffer) => chunks.push(chunk));
			req.on('end', () => {
				const raw = Buffer.concat(chunks).toString('utf-8');
				if (!raw) {
					reject(new Error('Empty request body'));
					return;
				}
				try {
					resolve(JSON.parse(raw));
				} catch {
					reject(new Error('Invalid JSON in request body'));
				}
			});
			req.on('error', reject);
		});
	}

	private getProjectDir(projectId: string): string {
		return path.join(this.dataDir, projectId);
	}

	private listBackups(projectId: string): BackupMeta[] {
		const dir = this.getProjectDir(projectId);
		let entries: string[];
		try {
			entries = fs.readdirSync(dir);
		} catch {
			return [];
		}

		const backups: BackupMeta[] = [];
		for (const entry of entries) {
			if (!entry.startsWith('v') || !entry.endsWith('.json')) continue;
			const version = entry.replace(/\.json$/, '');
			const statPath = path.join(dir, entry);
			try {
				const stat = fs.statSync(statPath);
				backups.push({
					version,
					timestamp: stat.mtime.toISOString(),
				});
			} catch {
				// skip unreadable
			}
		}

		// Sort by version number descending (newest first)
		backups.sort((a, b) => {
			const na = parseInt(a.version.slice(1), 10);
			const nb = parseInt(b.version.slice(1), 10);
			return nb - na;
		});

		return backups;
	}

	private getNextVersion(projectId: string): string {
		const backups = this.listBackups(projectId);
		if (backups.length === 0) return 'v1';
		const latest = backups[0]!;
		const num = parseInt(latest.version.slice(1), 10);
		return `v${num + 1}`;
	}

	private enforceMaxBackups(projectId: string): void {
		if (this.maxBackups <= 0) return;
		const dir = this.getProjectDir(projectId);
		const backups = this.listBackups(projectId);
		while (backups.length > this.maxBackups) {
			const oldest = backups.pop();
			if (oldest) {
				const filePath = path.join(dir, `${oldest.version}.json`);
				try {
					fs.unlinkSync(filePath);
				} catch {
					// ignore
				}
			}
		}
	}

	private getVersionPath(projectId: string, version: string): string {
		return path.join(this.getProjectDir(projectId), `${version}.json`);
	}

	private handleRequest(
		req: http.IncomingMessage,
		res: http.ServerResponse,
	): void {
		const origin = req.headers.origin;

		// Handle CORS preflight
		if (req.method === 'OPTIONS') {
			const cors = this.corsHeaders(origin);
			res.writeHead(204, cors);
			res.end();
			return;
		}

		const urlStr = req.url || '/';
		const parsedUrl = new URL(urlStr, `http://${req.headers.host || 'localhost'}`);
		const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
		const method = req.method || 'GET';

		const pLen = pathParts.length;
		const projectId = pathParts[2] as string | undefined;
		const version = pathParts[3] as string | undefined;

		try {
			// GET /api/health
			if (method === 'GET' && parsedUrl.pathname === '/api/health') {
				this.respond(res, 200, {
					status: 'ok',
					timestamp: new Date().toISOString(),
				}, origin);
				return;
			}

			// POST /api/backups/:projectId - Create backup
			if (
				method === 'POST' &&
				pLen === 3 &&
				pathParts[0] === 'api' &&
				pathParts[1] === 'backups' &&
				projectId
			) {
				void this.handleCreate(projectId, req, res, origin);
				return;
			}

			// GET /api/backups/latest/:projectId - Get latest backup
			if (
				method === 'GET' &&
				pLen === 4 &&
				pathParts[0] === 'api' &&
				pathParts[1] === 'backups' &&
				pathParts[2] === 'latest' &&
				version
			) {
				void this.handleGetLatest(version, res, origin);
				return;
			}

			// GET /api/backups/:projectId/:version - Get specific backup by version
			if (
				method === 'GET' &&
				pLen === 4 &&
				pathParts[0] === 'api' &&
				pathParts[1] === 'backups' &&
				projectId &&
				version &&
				pathParts[2] !== 'latest'
			) {
				void this.handleGetBackup(projectId, version, res, origin);
				return;
			}

			// DELETE /api/backups/:projectId/:version - Delete backup
			if (
				method === 'DELETE' &&
				pLen === 4 &&
				pathParts[0] === 'api' &&
				pathParts[1] === 'backups' &&
				projectId &&
				version
			) {
				void this.handleDelete(projectId, version, res, origin);
				return;
			}

			// PUT /api/backups/:projectId/:version - Update backup
			if (
				method === 'PUT' &&
				pLen === 4 &&
				pathParts[0] === 'api' &&
				pathParts[1] === 'backups' &&
				projectId &&
				version
			) {
				void this.handleUpdate(projectId, version, req, res, origin);
				return;
			}

			// GET /api/projects - List all projects
			if (
				method === 'GET' &&
				pLen === 2 &&
				pathParts[0] === 'api' &&
				pathParts[1] === 'projects'
			) {
				void this.handleListProjects(res, origin);
				return;
			}

			// GET /api/projects/:projectId - Get single project
			if (
				method === 'GET' &&
				pLen === 3 &&
				pathParts[0] === 'api' &&
				pathParts[1] === 'projects' &&
				projectId
			) {
				void this.handleGetProject(projectId, res, origin);
				return;
			}

			// DELETE /api/projects/:projectId - Delete entire project + backups
			if (
				method === 'DELETE' &&
				pLen === 3 &&
				pathParts[0] === 'api' &&
				pathParts[1] === 'projects' &&
				projectId
			) {
				void this.handleDeleteProject(projectId, res, origin);
				return;
			}

			// 404 for unmatched routes
			this.respond(res, 404, { error: 'Not found' }, origin);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			this.respond(res, 500, { error: msg }, origin);
		}
	}

	/** Read a backup file and extract project metadata fields. */
	private readProjectInfo(projectId: string): Record<string, unknown> | null {
		const backups = this.listBackups(projectId);
		if (backups.length === 0) return null;

		const latest = backups[0]!;
		const filePath = this.getVersionPath(projectId, latest.version);

		try {
			const content = fs.readFileSync(filePath, 'utf-8');
			const data = JSON.parse(content) as Record<string, unknown>;
			const config = data?.config as Record<string, unknown> | undefined;

			return {
				projectId,
				conlangName: config?.conlangName ?? '',
				authorName: config?.authorName ?? '',
				description: config?.description ?? '',
				phonologyTypes: config?.phonologyTypes ?? '',
				conlangIcon: config?.conlangIcon ?? '',
				alphabeticScript: config?.alphabeticScript ?? '',
			};
		} catch {
			return null;
		}
	}

	/** Read backup list with file sizes for a project. */
	private listBackupsWithSizes(projectId: string): Array<{
		version: string;
		timestamp: string;
		sizeBytes: number;
	}> {
		const dir = this.getProjectDir(projectId);
		let entries: string[];
		try {
			entries = fs.readdirSync(dir);
		} catch {
			return [];
		}

		const result: Array<{
			version: string;
			timestamp: string;
			sizeBytes: number;
		}> = [];

		for (const entry of entries) {
			if (!entry.startsWith('v') || !entry.endsWith('.json')) continue;
			const version = entry.replace(/\.json$/, '');
			const statPath = path.join(dir, entry);
			try {
				const stat = fs.statSync(statPath);
				result.push({
					version,
					timestamp: stat.mtime.toISOString(),
					sizeBytes: stat.size,
				});
			} catch {
				// skip unreadable
			}
		}

		// Sort newest first
		result.sort((a, b) => {
			const na = parseInt(a.version.slice(1), 10);
			const nb = parseInt(b.version.slice(1), 10);
			return nb - na;
		});

		return result;
	}

	private async handleListProjects(
		res: http.ServerResponse,
		origin?: string,
	): Promise<void> {
		let entries: string[];
		try {
			entries = fs.readdirSync(this.dataDir);
		} catch {
			this.respond(res, 200, { projects: [] }, origin);
			return;
		}

		const projects: Array<Record<string, unknown>> = [];

		for (const entry of entries) {
			const projectDir = path.join(this.dataDir, entry);
			try {
				const stat = fs.statSync(projectDir);
				if (!stat.isDirectory()) continue;
			} catch {
				continue;
			}

			const info = this.readProjectInfo(entry);
			const backupsWithSizes = this.listBackupsWithSizes(entry);

			const latestVersion = backupsWithSizes[0]?.version ?? null;
			const lastBackupTime = backupsWithSizes[0]?.timestamp ?? null;
			const totalSizeBytes = backupsWithSizes.reduce(
				(sum, b) => sum + b.sizeBytes,
				0,
			);

			projects.push({
				...(info ?? { projectId: entry }),
				lastBackupTime,
				latestVersion,
				totalBackups: backupsWithSizes.length,
				totalSizeBytes,
				backups: backupsWithSizes,
			});
		}

		// Sort by lastBackupTime descending (most recently backed up first)
		projects.sort((a, b) => {
			const ta = a.lastBackupTime as string | null;
			const tb = b.lastBackupTime as string | null;
			if (!ta && !tb) return 0;
			if (!ta) return 1;
			if (!tb) return -1;
			return tb.localeCompare(ta);
		});

		this.respond(res, 200, { projects }, origin);
	}

	private async handleGetProject(
		projectId: string,
		res: http.ServerResponse,
		origin?: string,
	): Promise<void> {
		const info = this.readProjectInfo(projectId);
		const backupsWithSizes = this.listBackupsWithSizes(projectId);

		if (!info && backupsWithSizes.length === 0) {
			this.respond(res, 404, { error: `Project "${projectId}" not found` }, origin);
			return;
		}

		const latestVersion = backupsWithSizes[0]?.version ?? null;
		const lastBackupTime = backupsWithSizes[0]?.timestamp ?? null;
		const totalSizeBytes = backupsWithSizes.reduce(
			(sum, b) => sum + b.sizeBytes,
			0,
		);

		this.respond(res, 200, {
			...(info ?? { projectId }),
			lastBackupTime,
			latestVersion,
			totalBackups: backupsWithSizes.length,
			totalSizeBytes,
			backups: backupsWithSizes,
		}, origin);
	}

	private async handleDeleteProject(
		projectId: string,
		res: http.ServerResponse,
		origin?: string,
	): Promise<void> {
		const dir = this.getProjectDir(projectId);

		// Guard against path traversal: resolved dir must stay under dataDir.
		const resolvedDir = path.resolve(dir);
		const resolvedRoot = path.resolve(this.dataDir);
		if (
			resolvedDir === resolvedRoot ||
			!resolvedDir.startsWith(resolvedRoot + path.sep)
		) {
			this.respond(res, 400, { error: 'Invalid project ID' }, origin);
			return;
		}

		let stat: fs.Stats;
		try {
			stat = fs.statSync(resolvedDir);
		} catch {
			this.respond(res, 404, { error: `Project "${projectId}" not found` }, origin);
			return;
		}
		if (!stat.isDirectory()) {
			this.respond(res, 404, { error: `Project "${projectId}" not found` }, origin);
			return;
		}

		const removedBackups = this.listBackups(projectId).length;

		try {
			fs.rmSync(resolvedDir, { recursive: true, force: true });
			this.respond(res, 200, {
				deleted: projectId,
				removedBackups,
			}, origin);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			this.respond(res, 500, { error: msg }, origin);
		}
	}

	private async handleCreate(
		projectId: string,
		req: http.IncomingMessage,
		res: http.ServerResponse,
		origin?: string,
	): Promise<void> {
		try {
			const body = await this.parseBody(req) as Record<string, unknown>;

			// Validate config.projectId matches URL param
			const bodyConfig = body?.config as Record<string, unknown> | undefined;
			const bodyProjectId = bodyConfig?.projectId;
			if (bodyProjectId !== undefined && bodyProjectId !== projectId) {
				this.respond(res, 409, {
					error: `Project ID mismatch: URL has "${projectId}" but body has "${String(bodyProjectId)}"`,
				}, origin);
				return;
			}

			const version = this.getNextVersion(projectId);
			const filePath = this.getVersionPath(projectId, version);
			fs.mkdirSync(this.getProjectDir(projectId), { recursive: true });
			fs.writeFileSync(filePath, JSON.stringify(body, null, 2), 'utf-8');
			this.enforceMaxBackups(projectId);
			this.respond(res, 201, {
				version,
				timestamp: new Date().toISOString(),
			}, origin);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			this.respond(res, 400, { error: msg }, origin);
		}
	}

	private async handleGetLatest(
		projectId: string,
		res: http.ServerResponse,
		origin?: string,
	): Promise<void> {
		const backups = this.listBackups(projectId);
		if (backups.length === 0) {
			this.respond(res, 404, { error: 'No backups found' }, origin);
			return;
		}

		const latest = backups[0]!;
		const filePath = this.getVersionPath(projectId, latest.version);

		try {
			const content = fs.readFileSync(filePath, 'utf-8');
			const data = JSON.parse(content);
			this.respond(res, 200, data, origin);
		} catch {
			this.respond(res, 500, { error: 'Failed to read backup file' }, origin);
		}
	}

	private async handleGetBackup(
		projectId: string,
		version: string,
		res: http.ServerResponse,
		origin?: string,
	): Promise<void> {
		const filePath = this.getVersionPath(projectId, version);
		if (!fs.existsSync(filePath)) {
			this.respond(res, 404, { error: `Backup ${version} not found for project "${projectId}"` }, origin);
			return;
		}

		try {
			const content = fs.readFileSync(filePath, 'utf-8');
			const data = JSON.parse(content);
			this.respond(res, 200, data, origin);
		} catch {
			this.respond(res, 500, { error: 'Failed to read backup file' }, origin);
		}
	}

	private async handleDelete(
		projectId: string,
		version: string,
		res: http.ServerResponse,
		origin?: string,
	): Promise<void> {
		const filePath = this.getVersionPath(projectId, version);
		if (!fs.existsSync(filePath)) {
			this.respond(res, 404, { error: `Backup ${version} not found` }, origin);
			return;
		}

		try {
			fs.unlinkSync(filePath);
			this.respond(res, 200, { deleted: version }, origin);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			this.respond(res, 500, { error: msg }, origin);
		}
	}

	private async handleUpdate(
		projectId: string,
		version: string,
		req: http.IncomingMessage,
		res: http.ServerResponse,
		origin?: string,
	): Promise<void> {
		const filePath = this.getVersionPath(projectId, version);
		if (!fs.existsSync(filePath)) {
			this.respond(res, 404, { error: `Backup ${version} not found` }, origin);
			return;
		}

		try {
			const body = await this.parseBody(req) as Record<string, unknown>;

			// Validate config.projectId matches URL param
			const bodyConfig = body?.config as Record<string, unknown> | undefined;
			const bodyProjectId = bodyConfig?.projectId;
			if (bodyProjectId !== undefined && bodyProjectId !== projectId) {
				this.respond(res, 409, {
					error: `Project ID mismatch: URL has "${projectId}" but body has "${String(bodyProjectId)}"`,
				}, origin);
				return;
			}

			fs.mkdirSync(path.dirname(filePath), { recursive: true });
			fs.writeFileSync(filePath, JSON.stringify(body, null, 2), 'utf-8');
			this.respond(res, 200, { version, updated: true }, origin);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			this.respond(res, 400, { error: msg }, origin);
		}
	}
}