import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import type ConlangBackupPlugin from './main';

export interface ConlangBackupSettings {
	apiPort: number;
	apiKey: string;
	maxBackups: number;
	backupDir: string;
}

export const DEFAULT_SETTINGS: ConlangBackupSettings = {
	apiPort: 3000,
	apiKey: '',
	maxBackups: 0,
	backupDir: 'conlang-backups',
};

export class BackupSettingsTab extends PluginSettingTab {
	plugin: ConlangBackupPlugin;

	private statusIndicator!: HTMLElement;
	private portText!: HTMLInputElement;
	private startBtn!: HTMLElement;
	private stopBtn!: HTMLElement;

	constructor(app: App, plugin: ConlangBackupPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	private updateServerUI(): void {
		const running = this.plugin.isServerRunning();
		const err = this.plugin.serverLastError();

		if (this.statusIndicator) {
			if (running) {
				this.statusIndicator.setText('Running');
				this.statusIndicator.setAttr('class', 'api-status-online');
			} else if (err) {
				this.statusIndicator.setText(`Error: ${err}`);
				this.statusIndicator.setAttr('class', 'api-status-offline');
			} else {
				this.statusIndicator.setText('Stopped');
				this.statusIndicator.setAttr('class', 'api-status-offline');
			}
		}

		if (this.startBtn) {
			this.startBtn.setAttr('disabled', running ? 'true' : null);
		}
		if (this.stopBtn) {
			this.stopBtn.setAttr('disabled', !running ? 'true' : null);
		}
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h3', { text: 'Conlang Engine Backup' });

		containerEl.createEl('p', {
			text: 'Manage the local backup API server and backup preferences.',
		});

		// Server status
		const statusContainer = containerEl.createDiv({ cls: 'api-status-container' });
		statusContainer.createEl('span', { text: 'Server: ', cls: 'api-status-label' });
		this.statusIndicator = statusContainer.createEl('span', {
			text: '...',
			cls: 'api-status-checking',
		});

		// Port setting
		new Setting(containerEl)
			.setName('API Port')
			.setDesc('Port for the local backup API server (restart required)')
			.addText((text) => {
				this.portText = text.inputEl;
				text.inputEl.type = 'number';
				text.inputEl.min = '1024';
				text.inputEl.max = '65535';
				text
					.setPlaceholder('3000')
					.setValue(String(this.plugin.settings.apiPort))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num >= 1024 && num <= 65535) {
							this.plugin.settings.apiPort = num;
							await this.plugin.saveSettings();
						}
					});
				return text;
			});

		// Server controls
		new Setting(containerEl)
			.setName('Server controls')
			.setDesc('Start, stop, or restart the local backup API server')
			.addButton((button) => {
				this.startBtn = button.buttonEl;
				button
					.setButtonText('Start')
					.setCta()
					.onClick(() => {
						void this.plugin.startServer();
						setTimeout(() => this.updateServerUI(), 500);
					});
				return button;
			})
			.addButton((button) => {
				this.stopBtn = button.buttonEl;
				button
					.setButtonText('Stop')
					.onClick(async () => {
						await this.plugin.stopServer();
						this.updateServerUI();
					});
				return button;
			})
			.addButton((button) => {
				button
					.setButtonText('Restart')
					.onClick(async () => {
						await this.plugin.restartServer();
						setTimeout(() => this.updateServerUI(), 500);
					});
				return button;
			});

		// Connection test
		new Setting(containerEl)
			.setName('Test connection')
			.setDesc('Verify the API server is reachable')
			.addButton((button) =>
				button
					.setButtonText('Test')
					.onClick(async () => {
						const notice = new Notice('Testing connection...', 0);
						try {
							const url = `http://localhost:${this.plugin.settings.apiPort}/api/health`;
							const res = await fetch(url, { method: 'GET' });
							const data = await res.json();
							notice.hide();
							if (res.ok && data.status === 'ok') {
								new Notice('Connection successful!', 3000);
							} else {
								new Notice(`Server responded with status ${res.status}`, 5000);
							}
						} catch {
							notice.hide();
							new Notice('Connection failed — is the server running?', 5000);
						} finally {
							this.updateServerUI();
						}
					}),
			);

		// Backup directory — folder suggester
		new Setting(containerEl)
			.setName('Backup directory')
			.setDesc('Subdirectory in vault where backup files are stored')
			.addSearch((search) => {
				const input = search.inputEl;
				input.placeholder = 'conlang-backups';
				input.value = this.plugin.settings.backupDir;

				const suggestionsEl = containerEl.createDiv({
					cls: 'backup-dir-suggestions',
				});
				suggestionsEl.style.cssText =
					'display:none;position:relative;max-height:200px;overflow-y:auto;' +
					'border:1px solid var(--background-modifier-border);border-radius:4px;' +
					'margin-top:4px;background:var(--background-primary);z-index:100;';

				const showSuggestions = (query: string) => {
					const folders = this.app.vault.getAllLoadedFiles()
						.filter((f): f is import('obsidian').TFolder =>
							(f as import('obsidian').TFolder).children !== undefined,
						)
						.map((f) => f.path)
						.filter((p) => p !== '');

					const allItems = [query, ...folders];
					const unique = [...new Set(allItems)];

					const matches = query
						? unique.filter((p) =>
								p.toLowerCase().includes(query.toLowerCase()),
						  )
						: unique;

					const top = matches.slice(0, 12);

					suggestionsEl.empty();
					if (top.length === 0 || (top.length === 1 && top[0] === query)) {
						suggestionsEl.style.display = 'none';
						return;
					}

					suggestionsEl.style.display = 'block';

					top.forEach((p) => {
						const item = suggestionsEl.createEl('div', {
							text: p,
							cls: 'backup-dir-suggestion-item',
						});
						item.style.cssText =
							'padding:6px 10px;cursor:pointer;font-size:0.85em;' +
							'border-bottom:1px solid var(--background-modifier-border);';
						item.addEventListener('mouseenter', () => {
							item.style.background = 'var(--background-modifier-hover)';
						});
						item.addEventListener('mouseleave', () => {
							item.style.background = 'transparent';
						});
						item.addEventListener('click', () => {
							input.value = p;
							this.plugin.settings.backupDir = p;
							void this.plugin.saveSettings();
							suggestionsEl.style.display = 'none';
						});
					});
				};

				let debounceTimer: number | null = null;
				input.addEventListener('input', () => {
					if (debounceTimer) window.clearTimeout(debounceTimer);
					debounceTimer = window.setTimeout(() => {
						showSuggestions(input.value);
					}, 100);
				});

				input.addEventListener('blur', () => {
					setTimeout(() => {
						suggestionsEl.style.display = 'none';
					}, 200);
				});

				input.addEventListener('focus', () => {
					showSuggestions(input.value);
				});

				search.onChange(async (value) => {
					this.plugin.settings.backupDir = value;
					await this.plugin.saveSettings();
				});

				return search;
			});

		// Max backups
		new Setting(containerEl)
			.setName('Max backups to keep')
			.setDesc('Maximum number of versions to retain on the server (0 = unlimited)')
			.addText((text) =>
				text
					.setPlaceholder('0')
					.setValue(String(this.plugin.settings.maxBackups))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						this.plugin.settings.maxBackups = isNaN(num) ? 0 : num;
						await this.plugin.saveSettings();
						this.plugin.updateServerConfig();
					}),
			);

		// Initial UI update
		this.updateServerUI();
	}
}