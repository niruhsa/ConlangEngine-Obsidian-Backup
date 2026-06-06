import { App, Notice, Plugin, TFile, Modal, Setting, TextComponent } from 'obsidian';
import * as path from 'path';
import {
	type ConlangBackupSettings,
	DEFAULT_SETTINGS,
	BackupSettingsTab,
} from './settings';
import { BackupApiClient } from './api-client';
import { BackupApiServer } from './api-server';
import type {
	BackupPayload,
	BackupInfo,
} from './types';

export default class ConlangBackupPlugin extends Plugin {
	settings!: ConlangBackupSettings;
	private server: BackupApiServer | null = null;
	private isSaving = false;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new BackupSettingsTab(this.app, this));

		this.addCommand({
			id: 'conlang-backup-save',
			name: 'Save backup',
			callback: () => this.saveBackup(),
		});

		this.addCommand({
			id: 'conlang-backup-load-latest',
			name: 'Load latest backup',
			callback: () => this.loadLatestBackup(),
		});

		this.addCommand({
			id: 'conlang-backup-list',
			name: 'List backups',
			callback: () => this.listBackups(),
		});

		this.addCommand({
			id: 'conlang-backup-delete',
			name: 'Delete backup',
			callback: () => this.deleteBackup(),
		});

		this.addCommand({
			id: 'conlang-backup-force-update',
			name: 'Force update backup',
			callback: () => this.forceUpdateBackup(),
		});

		this.addCommand({
			id: 'conlang-backup-delete-project',
			name: 'Delete entire project',
			callback: () => this.deleteProject(),
		});

		this.addCommand({
			id: 'conlang-backup-server-start',
			name: 'Start API server',
			callback: () => void this.startServer(),
		});

		this.addCommand({
			id: 'conlang-backup-server-stop',
			name: 'Stop API server',
			callback: () => void this.stopServer(),
		});

		await this.startServer();
	}

	async onunload() {
		await this.stopServer();
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData() as Partial<ConlangBackupSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	// ---- API Server management ----

	isServerRunning(): boolean {
		return this.server?.isRunning ?? false;
	}

	serverLastError(): string | null {
		return this.server?.lastError ?? null;
	}

	async startServer(): Promise<void> {
		if (this.server?.isRunning) return;

		const storageDir = await this.getServerStorageDir();
		const port = this.settings.apiPort || DEFAULT_SETTINGS.apiPort;
		this.server = new BackupApiServer(port, storageDir, this.settings.maxBackups);

		try {
			await this.server.start();
			new Notice(`Backup API server started on port ${port}`, 3000);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			new Notice(`Failed to start server on port ${port}: ${msg}`, 8000);
		}
	}

	private async getServerStorageDir(): Promise<string> {
		const adapter = this.app.vault.adapter;
		let vaultPath: string;

		if ('getBasePath' in adapter && typeof (adapter as { getBasePath: () => string }).getBasePath === 'function') {
			vaultPath = (adapter as { getBasePath: () => string }).getBasePath();
		} else {
			vaultPath = (this.app.vault as unknown as { configDir: string }).configDir || '.';
		}

		const relDir = this.settings.backupDir || DEFAULT_SETTINGS.backupDir;
		return path.join(vaultPath, relDir);
	}

	async stopServer(): Promise<void> {
		if (!this.server?.isRunning) return;
		await this.server.stop();
		new Notice('Backup API server stopped', 3000);
	}

	async restartServer(): Promise<void> {
		const wasRunning = this.server?.isRunning;
		await this.stopServer();
		if (wasRunning) {
			await new Promise((resolve) => setTimeout(resolve, 500));
		}
		await this.startServer();
	}

	updateServerConfig(): void {
		if (this.server) {
			this.server.updateConfig(this.settings.apiPort, this.settings.maxBackups);
		}
	}

	// ---- Vault file I/O ----

	private getBackupFilePath(): string {
		const dir = this.settings.backupDir || DEFAULT_SETTINGS.backupDir;
		return `${dir}/current.json`;
	}

	private async readBackupPayload(): Promise<BackupPayload | null> {
		const filePath = this.getBackupFilePath();

		try {
			const file = this.app.vault.getAbstractFileByPath(filePath);
			if (!file || !(file instanceof TFile)) return null;

			const content = await this.app.vault.read(file);
			if (!content) return null;

			return JSON.parse(content) as BackupPayload;
		} catch (error) {
			console.log(`Failed to read backup file at ${filePath}:`, error);
			return null;
		}
	}

	private async writeBackupPayload(data: BackupPayload): Promise<void> {
		const filePath = this.getBackupFilePath();
		const dir = this.settings.backupDir || DEFAULT_SETTINGS.backupDir;

		try {
			const folder = this.app.vault.getAbstractFileByPath(dir);
			if (!folder) {
				await this.app.vault.createFolder(dir);
			}

			const content = JSON.stringify(data, undefined, 2);
			const existingFile = this.app.vault.getAbstractFileByPath(filePath);

			if (existingFile && existingFile instanceof TFile) {
				await this.app.vault.modify(existingFile, content);
			} else {
				await this.app.vault.create(filePath, content);
			}
		} catch (error) {
			console.error(`Failed to write backup file at ${filePath}:`, error);
			throw new Error(
				`Failed to write backup file: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/** Extract projectId from a backup payload's config. */
	private extractProjectId(payload: BackupPayload): string {
		return payload?.config?.projectId || '';
	}

	private getApiUrl(): string {
		return `http://localhost:${this.settings.apiPort}`;
	}

	private getClient(): BackupApiClient {
		return new BackupApiClient(this.getApiUrl());
	}

	/** Prompt user for a projectId via modal. */
	private promptForProjectId(
		title: string,
		onSubmit: (projectId: string) => void,
	): void {
		new ProjectIdPromptModal(this.app, title, onSubmit).open();
	}

	// ---- Command handlers ----

	async saveBackup() {
		if (this.isSaving) {
			new Notice('Backup already in progress...');
			return;
		}

		const notice = new Notice('Reading backup file...', 0);

		try {
			this.isSaving = true;

			const payload = await this.readBackupPayload();
			if (!payload) {
				notice.hide();
				new Notice(
					`No backup file found at ${this.getBackupFilePath()}. Export from Conlang Engine web app first.`,
				);
				return;
			}

			const projectId = this.extractProjectId(payload);
			if (!projectId) {
				notice.hide();
				new Notice('Backup file is missing config.projectId. Cannot determine project.');
				return;
			}

			notice.hide();
			const uploadNotice = new Notice('Uploading to backup server...', 0);

			const client = this.getClient();
			const response = await client.createBackup(projectId, payload);

			uploadNotice.hide();
			new Notice(`Backup saved: ${response.version} (${response.timestamp})`, 5000);
		} catch (error) {
			notice.hide();
			const msg = error instanceof Error ? error.message : String(error);
			new Notice(`Backup failed: ${msg}`, 8000);
		} finally {
			this.isSaving = false;
		}
	}

	async loadLatestBackup() {
		this.promptForProjectId('Load latest backup', async (projectId) => {
			const notice = new Notice('Fetching latest backup...', 0);

			try {
				const client = this.getClient();
				const payload = await client.getLatestBackup(projectId);

				notice.hide();
				const saveNotice = new Notice('Saving to vault...', 0);

				await this.writeBackupPayload(payload);

				saveNotice.hide();
				new Notice(
					'Backup restored to vault. Reload Conlang Engine web app to apply changes.',
					8000,
				);
			} catch (error) {
				notice.hide();
				const msg = error instanceof Error ? error.message : String(error);
				new Notice(`Load failed: ${msg}`, 8000);
			}
		});
	}

	async listBackups() {
		this.promptForProjectId('List backups', async (projectId) => {
			const notice = new Notice('Fetching backups...', 0);

			try {
				const client = this.getClient();
				const response = await client.listBackups(projectId);

				notice.hide();

				if (response.backups.length === 0) {
					new Notice('No backups found for this project.');
					return;
				}

				new BackupListModal(
					this.app,
					response.backups,
					projectId,
					(version: string) => {
						void version;
						new Notice('Selected backup (load by version not yet implemented)');
					},
				).open();
			} catch (error) {
				notice.hide();
				const msg = error instanceof Error ? error.message : String(error);
				new Notice(`List failed: ${msg}`, 8000);
			}
		});
	}

	async deleteBackup() {
		this.promptForProjectId('Delete backup', async (projectId) => {
			const client = this.getClient();

			const notice = new Notice('Fetching backups...', 0);
			let backups: BackupInfo[] = [];

			try {
				const response = await client.listBackups(projectId);
				backups = response.backups;
				notice.hide();
			} catch (error) {
				notice.hide();
				const msg = error instanceof Error ? error.message : String(error);
				new Notice(`Failed to fetch backups: ${msg}`, 8000);
				return;
			}

			if (backups.length === 0) {
				new Notice('No backups to delete.');
				return;
			}

			new BackupDeleteModal(this.app, backups, async (version: string) => {
				const delNotice = new Notice(`Deleting backup ${version}...`, 0);

				try {
					await client.deleteBackup(projectId, version);
					delNotice.hide();
					new Notice(`Deleted backup ${version}`, 5000);
				} catch (error) {
					delNotice.hide();
					const msg = error instanceof Error ? error.message : String(error);
					new Notice(`Delete failed: ${msg}`, 8000);
				}
			}).open();
		});
	}

	async deleteProject() {
		this.promptForProjectId('Delete entire project', (projectId) => {
			new ConfirmModal(
				this.app,
				'Delete entire project',
				`This permanently deletes project "${projectId}" and ALL of its backups. This cannot be undone.`,
				async () => {
					const notice = new Notice(`Deleting project ${projectId}...`, 0);
					try {
						await this.getClient().deleteProject(projectId);
						notice.hide();
						new Notice(`Deleted project ${projectId}`, 5000);
					} catch (error) {
						notice.hide();
						const msg = error instanceof Error ? error.message : String(error);
						new Notice(`Delete failed: ${msg}`, 8000);
					}
				},
			).open();
		});
	}

	async forceUpdateBackup() {
		this.promptForProjectId('Force update backup', async (projectId) => {
			const client = this.getClient();

			const listNotice = new Notice('Fetching backups...', 0);
			let backups: BackupInfo[] = [];

			try {
				const response = await client.listBackups(projectId);
				backups = response.backups;
				listNotice.hide();
			} catch (error) {
				listNotice.hide();
				const msg = error instanceof Error ? error.message : String(error);
				new Notice(`Failed to fetch backups: ${msg}`, 8000);
				return;
			}

			if (backups.length === 0) {
				new Notice('No backups to update. Create a backup first.');
				return;
			}

			new BackupUpdateModal(this.app, backups, async (version: string) => {
				const readNotice = new Notice('Reading backup file...', 0);

				try {
					const payload = await this.readBackupPayload();
					if (!payload) {
						readNotice.hide();
						new Notice(
							`No backup file found at ${this.getBackupFilePath()}. Export from Conlang Engine web app first.`,
						);
						return;
					}

					readNotice.hide();
					const uploadNotice = new Notice(`Updating backup ${version}...`, 0);

					await client.updateBackup(projectId, version, payload);

					uploadNotice.hide();
					new Notice(`Updated backup ${version}`, 5000);
				} catch (error) {
					readNotice.hide();
					const msg = error instanceof Error ? error.message : String(error);
					new Notice(`Update failed: ${msg}`, 8000);
				}
			}).open();
		});
	}
}

// ---- Modals ----

/** Modal that asks the user to confirm a destructive action. */
class ConfirmModal extends Modal {
	private titleText: string;
	private message: string;
	private onConfirm: () => void;

	constructor(app: App, titleText: string, message: string, onConfirm: () => void) {
		super(app);
		this.titleText = titleText;
		this.message = message;
		this.onConfirm = onConfirm;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h3', { text: this.titleText });
		contentEl.createEl('p', { text: this.message });

		new Setting(contentEl)
			.addButton((button) =>
				button
					.setButtonText('Delete')
					.setWarning()
					.onClick(() => {
						this.close();
						this.onConfirm();
					}),
			)
			.addButton((button) =>
				button
					.setButtonText('Cancel')
					.onClick(() => {
						this.close();
					}),
			);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

/** Modal that prompts user to enter a project ID. */
class ProjectIdPromptModal extends Modal {
	private onSubmit: (projectId: string) => void;
	private title: string;

	constructor(app: App, title: string, onSubmit: (projectId: string) => void) {
		super(app);
		this.title = title;
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h3', { text: this.title });
		contentEl.createEl('p', { text: 'Enter the project ID:' });

		let inputValue = '';

		new Setting(contentEl)
			.setName('Project ID')
			.addText((text: TextComponent) => {
				text.setPlaceholder('local_1234567890');
				text.onChange((value) => {
					inputValue = value;
				});
				// Trigger onChange on Enter
				text.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
					if (e.key === 'Enter' && inputValue) {
						this.close();
						this.onSubmit(inputValue);
					}
				});
				return text;
			});

		new Setting(contentEl)
			.addButton((button) =>
				button
					.setButtonText('Submit')
					.setCta()
					.onClick(() => {
						if (inputValue) {
							this.close();
							this.onSubmit(inputValue);
						}
					}),
			)
			.addButton((button) =>
				button
					.setButtonText('Cancel')
					.onClick(() => {
						this.close();
					}),
			);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class BackupListModal extends Modal {
	backups: BackupInfo[];
	projectId: string;
	onSelect: (version: string) => void;

	constructor(
		app: App,
		backups: BackupInfo[],
		projectId: string,
		onSelect: (version: string) => void,
	) {
		super(app);
		this.backups = backups;
		this.projectId = projectId;
		this.onSelect = onSelect;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h3', { text: 'Cloud Backups' });
		contentEl.createEl('p', {
			text: `Project: ${this.projectId}`,
			cls: 'backup-modal-subtitle',
		});

		const list = contentEl.createEl('ul', { cls: 'backup-list' });

		this.backups.forEach((backup) => {
			const item = list.createEl('li', { cls: 'backup-list-item' });
			item.createEl('span', {
				text: backup.version,
				cls: 'backup-version',
			});
			item.createEl('span', {
				text: new Date(backup.timestamp).toLocaleString(),
				cls: 'backup-timestamp',
			});
		});

		new Setting(contentEl)
			.addButton((button) =>
				button
					.setButtonText('Close')
					.setCta()
					.onClick(() => {
						this.close();
					}),
			);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class BackupDeleteModal extends Modal {
	backups: BackupInfo[];
	onDelete: (version: string) => void;
	selectedVersion: string;

	constructor(
		app: App,
		backups: BackupInfo[],
		onDelete: (version: string) => void,
	) {
		super(app);
		this.backups = backups;
		this.onDelete = onDelete;
		this.selectedVersion = backups[0]?.version ?? '';
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h3', { text: 'Delete Backup' });
		contentEl.createEl('p', { text: 'Select a backup version to delete:' });

		new Setting(contentEl)
			.setName('Version')
			.addDropdown((dropdown) => {
				this.backups.forEach((backup) => {
					dropdown.addOption(
						backup.version,
						`${backup.version} - ${new Date(backup.timestamp).toLocaleString()}`,
					);
				});
				dropdown.setValue(this.selectedVersion);
				dropdown.onChange((value) => {
					this.selectedVersion = value;
				});
				return dropdown;
			});

		new Setting(contentEl)
			.addButton((button) =>
				button
					.setButtonText('Delete')
					.setWarning()
					.onClick(() => {
						this.close();
						this.onDelete(this.selectedVersion);
					}),
			)
			.addButton((button) =>
				button
					.setButtonText('Cancel')
					.onClick(() => {
						this.close();
					}),
			);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class BackupUpdateModal extends Modal {
	backups: BackupInfo[];
	onUpdate: (version: string) => void;
	selectedVersion: string;

	constructor(
		app: App,
		backups: BackupInfo[],
		onUpdate: (version: string) => void,
	) {
		super(app);
		this.backups = backups;
		this.onUpdate = onUpdate;
		this.selectedVersion = backups[0]?.version ?? '';
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h3', { text: 'Force Update Backup' });
		contentEl.createEl('p', {
			text: 'Select a backup version to overwrite with current local data:',
		});

		new Setting(contentEl)
			.setName('Version')
			.addDropdown((dropdown) => {
				this.backups.forEach((backup) => {
					dropdown.addOption(
						backup.version,
						`${backup.version} - ${new Date(backup.timestamp).toLocaleString()}`,
					);
				});
				dropdown.setValue(this.selectedVersion);
				dropdown.onChange((value) => {
					this.selectedVersion = value;
				});
				return dropdown;
			});

		new Setting(contentEl)
			.addButton((button) =>
				button
					.setButtonText('Update')
					.setCta()
					.onClick(() => {
						this.close();
						this.onUpdate(this.selectedVersion);
					}),
			)
			.addButton((button) =>
				button
					.setButtonText('Cancel')
					.onClick(() => {
						this.close();
					}),
			);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}