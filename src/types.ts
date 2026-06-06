// Types for Conlang Engine Backup Plugin
// Maps to zustand stores: useConfigStore, useLexiconStore, useProjectStore

// Color scheme from useConfigStore
type ColorData = {
	bg: string;
	header: string;
	s1: string;
	s2: string;
	s3: string;
	s4: string;
	font: string;
	font2: string;
	accent: string;
	accent2: string;
	accent3: string;
	border: string;
	blur: string;
	glow: string;
};

// Activity from useConfigStore
type ActivityItem = {
	text: string;
	time: string;
};

// Block settings from useConfigStore
type BlockSettings = {
	maxChars: number;
	layoutTemplate: string;
	slotMapping: string[];
};

// Block template from useConfigStore
interface BlockTemplate extends BlockSettings {
	id: string;
}

// Grammar rule from useConfigStore
type GrammarRule = {
	id: string;
	name: string;
	affix: string;
	appliesTo: string;
	condition: string;
	dependency: string;
	standalone: boolean;
	applyToPersons: boolean;
	gloss: string;
};

// Person rule from useConfigStore
type PersonRule = {
	id: string;
	person: string;
	number: string;
	gender: string;
	freeForm: string;
	affix: string;
	appliesTo: string;
};

// Generator markers from useConfigStore
type GeneratorMarkers = {
	noun: string;
	verb: string;
	adjective: string;
	adverb: string;
	pronoun: string;
	particle: string;
};

// Number system from useConfigStore
type NumberSystem = {
	zero: string;
	digits: Record<string, string>;
	stems: Record<string, string>;
	powers: Record<string, string>;
	irregulars: Record<string, string>;
	settings: {
		fusion: boolean;
		separator: string;
		order: string;
	};
};

// Number derived rules from useConfigStore
type NumberDerivedRules = {
	ordinal: string;
	fractional: string;
	multiplier: string;
};

// Time system from useConfigStore
type TimeSystemVocab = {
	second: string;
	minute: string;
	hour: string;
	day: string;
	week: string;
	month: string;
	year: string;
};

// Calendar system from useConfigStore
type CalendarSystem = {
	daysOfWeek: string[];
	months: string[];
	dateFormat: string;
	yearOffset: number;
};

// Vowel harmony set from useConfigStore
type VowelHarmonySet = {
	name: string;
	vowels: string[];
};

// Word assist trigger from useConfigStore
type WordAssistTrigger = {
	id: string;
	name: string;
	trigger: string;
	marker: string;
	type: string;
	position: string;
	priority: number;
};

// Word assist config from useConfigStore
type WordAssistConfig = {
	syntaxOrder: string;
	copulaBehavior: string;
	copulaReplacement: string;
	triggers: WordAssistTrigger[];
};

// Function word from useConfigStore
type FunctionWord = {
	id: string;
	word: string;
	wordClass: string;
	translation?: string;
	definition?: string;
	tags?: string[];
};

// Stress rule from useConfigStore
type StressRule = {
	id: string;
	type: string;
	value: string;
	fallback?: string;
};

// Tone rule from useConfigStore
type ToneRule = {
	id: string;
	condition: string;
	value: string;
};

// Course phrase from useConfigStore
type CoursePhrase = {
	id: string;
	conlang: string;
	english: string;
};

// Custom course from useConfigStore
type CustomCourse = {
	id: string;
	title: string;
	phrases: CoursePhrase[];
};

// Full config state from useConfigStore
export type ConfigData = {
	projectId: string;
	conlangName: string;
	authorName: string;
	description: string;
	phonologyTypes: string;
	isPublic: boolean;
	conlangIcon: string;
	alphabeticScript: string;
	featuralComponents: Record<string, unknown>;
	blockSettings: BlockSettings;
	blockTemplates: BlockTemplate[];
	syllabificationAlgorithm: string;
	syntaxOrder: string;
	adjectivePlacement: string;
	adjectiveAgreement: boolean;
	writingDirection: string;
	consonants: string;
	vowels: string;
	syllablePattern: string;
	otherPhonemes: string;
	otherPhonemeMapping: string;
	enableToneAndStress: boolean;
	skipSyllableValidation: boolean;
	historicalRules: string;
	syllabaryMap: Record<string, unknown>;
	grammarRules: GrammarRule[];
	verbMarker: string;
	cliticsRules: string;
	personRules: PersonRule[];
	wikiPages: Record<string, string>;
	streak: number;
	unlockedBadges: string[];
	activity: ActivityItem[];
	isProActive: boolean;
	lastStudyDate: string | null;
	customFont: string | null;
	theme: string;
	colors: ColorData;
	customGlyphs: Record<string, unknown>;
	puaCounter: number;
	customFontBase64: string | null;
	isRehydrating: boolean;
	numeralBase: number;
	sentenceMaps: Array<unknown>;
	generatorMarkers: GeneratorMarkers;
	customWordClasses: string[];
	customTags: string[];
	autoReturnToLexicon: boolean;
	syllablePatternWeights: Record<string, number>;
	alphabetNames: Record<string, string>;
	numberSystem: NumberSystem;
	azureTtsUseIpa: boolean;
	numberMatrix: Record<string, unknown>;
	numberDerivedRules: NumberDerivedRules;
	timeSystemVocab: TimeSystemVocab;
	calendarSystem: CalendarSystem;
	vowelHarmonyMode: string;
	vowelHarmonySets: VowelHarmonySet[];
	vowelHarmonyOverrideWordClasses: string[];
	vowelHarmonyOverrideTags: string[];
	alphabetGlyphs: Record<string, string>;
	semanticMappings: Record<string, unknown>;
	wordAssistConfig: WordAssistConfig;
	functionWords: FunctionWord[];
	stressRules: StressRule[];
	toneRules: ToneRule[];
	customCourse: CustomCourse[];
};

// Lexicon entry from useLexiconStore
export type LexiconEntry = {
	id: number;
	word: string;
	ipa: string;
	wordClass: string;
	translation: string;
	definition: string;
	tags: string[];
	tagSource?: string;
	ideogram: string;
	personCategory: string;
	tone?: string;
	stress?: string;
	parentRootId: number | null;
	derivationRuleId: string | null;
	inflectionOverrides: Record<string, unknown>;
	srs?: Record<string, unknown>;
	createdAt: number;
};

// Lexicon state from useLexiconStore
export type LexiconData = {
	lexicon: LexiconEntry[];
};

// Local project from useProjectStore
export type LocalProject = {
	id: string;
	project_data: {
		config: Record<string, unknown>;
		dictionary: Record<string, unknown>;
	};
	updated_at: string;
};

// Project state from useProjectStore
export type ProjectData = {
	localProjects: LocalProject[];
};

// Full backup payload matching backup.example.json format
export type BackupPayload = {
	config: ConfigData;
	project: ProjectData;
	lexicon: LexiconData;
};

// API response types
export type BackupInfo = {
	version: string;
	timestamp: string;
};

export type BackupListResponse = {
	backups: BackupInfo[];
};

export type CreateBackupResponse = {
	version: string;
	timestamp: string;
};
