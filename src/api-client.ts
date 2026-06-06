import type {
	BackupPayload,
	BackupListResponse,
	CreateBackupResponse,
} from './types';

export class BackupApiClient {
	constructor(
		private baseUrl: string,
	) {}

	private headers(): Record<string, string> {
		return {
			'Content-Type': 'application/json',
		};
	}

	private async fetch(
		path: string,
		options: RequestInit,
	): Promise<Response> {
		const url = `${this.baseUrl}${path}`;
		const response = await fetch(url, {
			...options,
			headers: {
				...this.headers(),
				...(options.headers || {}),
			},
		});
		return response;
	}

	async createBackup(
		projectId: string,
		data: BackupPayload,
	): Promise<CreateBackupResponse> {
		const response = await this.fetch(`/api/backups/${encodeURIComponent(projectId)}`, {
			method: 'POST',
			body: JSON.stringify(data),
		});

		if (!response.ok) {
			const text = await response.text().catch(() => 'Unknown error');
			throw new Error(`Backup failed (${response.status}): ${text}`);
		}

		return response.json() as Promise<CreateBackupResponse>;
	}

	async getLatestBackup(projectId: string): Promise<BackupPayload> {
		const response = await this.fetch(
			`/api/backups/latest/${encodeURIComponent(projectId)}`,
			{ method: 'GET' },
		);

		if (!response.ok) {
			if (response.status === 404) {
				throw new Error('No backups found for this project');
			}
			const text = await response.text().catch(() => 'Unknown error');
			throw new Error(`Failed to load backup (${response.status}): ${text}`);
		}

		return response.json() as Promise<BackupPayload>;
	}

	async listBackups(projectId: string): Promise<BackupListResponse> {
		const response = await this.fetch(
			`/api/projects/${encodeURIComponent(projectId)}`,
			{ method: 'GET' },
		);

		if (!response.ok) {
			if (response.status === 404) {
				return { backups: [] };
			}
			const text = await response.text().catch(() => 'Unknown error');
			throw new Error(`Failed to list backups (${response.status}): ${text}`);
		}

		const data = await response.json() as { backups?: BackupListResponse['backups'] };
		return { backups: data.backups ?? [] };

		return response.json() as Promise<BackupListResponse>;
	}

	async deleteBackup(projectId: string, version: string): Promise<void> {
		const response = await this.fetch(
			`/api/backups/${encodeURIComponent(projectId)}/${encodeURIComponent(version)}`,
			{ method: 'DELETE' },
		);

		if (!response.ok) {
			if (response.status === 404) {
				throw new Error(`Backup ${version} not found`);
			}
			const text = await response.text().catch(() => 'Unknown error');
			throw new Error(`Failed to delete backup (${response.status}): ${text}`);
		}
	}

	async updateBackup(
		projectId: string,
		version: string,
		data: BackupPayload,
	): Promise<void> {
		const response = await this.fetch(
			`/api/backups/${encodeURIComponent(projectId)}/${encodeURIComponent(version)}`,
			{
				method: 'PUT',
				body: JSON.stringify(data),
			},
		);

		if (!response.ok) {
			const text = await response.text().catch(() => 'Unknown error');
			throw new Error(`Failed to update backup (${response.status}): ${text}`);
		}
	}
}
