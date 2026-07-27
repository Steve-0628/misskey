process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect } from '@jest/globals';
import { generateKeyPairSync } from 'node:crypto';
import { ApRendererService } from '@/core/activitypub/ApRendererService.js';

const testPublicKeyPem = generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey.export({ type: 'pkcs1', format: 'pem' });
import type { Config } from '@/config.js';
import type { UsersRepository, UserProfilesRepository, NotesRepository, DriveFilesRepository, EmojisRepository, PollsRepository } from '@/models/index.js';
import type { CustomEmojiService } from '@/core/CustomEmojiService.js';
import type { UserEntityService } from '@/core/entities/UserEntityService.js';
import type { DriveFileEntityService } from '@/core/entities/DriveFileEntityService.js';
import type { JsonLdService } from '@/core/activitypub/JsonLdService.js';
import type { UserKeypairService } from '@/core/UserKeypairService.js';
import type { ApMfmService } from '@/core/activitypub/ApMfmService.js';
import type { MfmService } from '@/core/MfmService.js';
import type { LocalUser } from '@/models/entities/User.js';
import type { Note } from '@/models/entities/Note.js';
import type { Blocking } from '@/models/entities/Blocking.js';
import type { DriveFile } from '@/models/entities/DriveFile.js';
import type { Emoji } from '@/models/entities/Emoji.js';
import type { Poll } from '@/models/entities/Poll.js';

function createLocalUser(id: string): LocalUser {
	return {
		id,
		host: null,
		username: `user${id}`,
		usernameLower: `user${id}`,
		isBot: false,
		isLocked: false,
		isExplorable: false,
		isCat: false,
		createdAt: new Date(),
	} as unknown as LocalUser;
}

function createNote(data: Partial<Note> = {}): Note {
	return {
		id: 'note1',
		userId: 'user1',
		createdAt: new Date(),
		visibility: 'public',
		text: 'hello',
		cw: null,
		mentions: [],
		tags: [],
		emojis: [],
		fileIds: [],
		mentionedRemoteUsers: '[]',
		hasPoll: false,
		...data,
	} as unknown as Note;
}

function createService() {
	const config = { url: 'https://example.com' } as unknown as Config;

	const usersRepository = {
		findOneByOrFail: jest.fn(),
		findBy: jest.fn().mockResolvedValue([]),
		exist: jest.fn().mockResolvedValue(false),
	} as unknown as jest.Mocked<UsersRepository>;

	const userProfilesRepository = {
		findOneByOrFail: jest.fn().mockResolvedValue({
			description: null,
			fields: [],
			birthday: null,
			location: null,
		}),
	} as unknown as jest.Mocked<UserProfilesRepository>;

	const notesRepository = {
		findOneBy: jest.fn().mockResolvedValue(null),
	} as unknown as jest.Mocked<NotesRepository>;

	const driveFilesRepository = {
		findBy: jest.fn().mockResolvedValue([]),
		findOneBy: jest.fn().mockResolvedValue(null),
	} as unknown as jest.Mocked<DriveFilesRepository>;

	const emojisRepository = {} as unknown as EmojisRepository;
	const pollsRepository = {
		findOneBy: jest.fn().mockResolvedValue(null),
	} as unknown as jest.Mocked<PollsRepository>;

	const customEmojiService = {
		localEmojisCache: {
			fetch: jest.fn().mockResolvedValue(new Map()),
		},
	} as unknown as CustomEmojiService;

	const userEntityService = {
		genLocalUserUri: jest.fn().mockImplementation((id: string) => `https://example.com/users/${id}`),
		getUserUri: jest.fn().mockImplementation((user: any) => user.host ? `https://${user.host}/users/${user.id}` : `https://example.com/users/${user.id}`),
		isRemoteUser: jest.fn().mockReturnValue(false),
	} as unknown as jest.Mocked<UserEntityService>;

	const driveFileEntityService = {
		getPublicUrl: jest.fn().mockReturnValue('https://example.com/file.png'),
	} as unknown as DriveFileEntityService;

	const jsonLdService = {
		use: jest.fn().mockReturnValue({
			signRsaSignature2017: jest.fn().mockResolvedValue({ signed: true }),
		}),
	} as unknown as JsonLdService;

	const userKeypairService = {
		getUserKeypair: jest.fn().mockResolvedValue({
			publicKey: Buffer.from(testPublicKeyPem as string),
			privateKey: 'private',
		}),
	} as unknown as UserKeypairService;

	const apMfmService = {
		getNoteHtml: jest.fn().mockReturnValue('<p>hello</p>'),
	} as unknown as ApMfmService;

	const mfmService = {
		toHtml: jest.fn().mockReturnValue('<p>bio</p>'),
	} as unknown as MfmService;

	const service = new ApRendererService(
		config,
		usersRepository,
		userProfilesRepository,
		notesRepository,
		driveFilesRepository,
		emojisRepository,
		pollsRepository,
		customEmojiService,
		userEntityService,
		driveFileEntityService,
		jsonLdService,
		userKeypairService,
		apMfmService,
		mfmService,
	);

	return {
		service,
		mocks: {
			usersRepository,
			userProfilesRepository,
			notesRepository,
			driveFilesRepository,
			pollsRepository,
			customEmojiService,
			userEntityService,
			driveFileEntityService,
			jsonLdService,
			userKeypairService,
			apMfmService,
			mfmService,
		},
	};
}

describe('ApRendererService', () => {
	test('renderAccept', () => {
		const { service } = createService();
		const result = service.renderAccept({ type: 'Follow' }, createLocalUser('user1'));
		expect(result.type).toBe('Accept');
		expect(result.actor).toBe('https://example.com/users/user1');
	});

	test('renderAdd', () => {
		const { service } = createService();
		const result = service.renderAdd(createLocalUser('user1'), 'target', { type: 'Note' });
		expect(result.type).toBe('Add');
		expect(result.target).toBe('target');
	});

	test('renderAnnounce public', () => {
		const { service } = createService();
		const note = createNote({ visibility: 'public', userId: 'user1' });
		const result = service.renderAnnounce('https://remote.example/note', note);
		expect(result.type).toBe('Announce');
		expect(result.to).toContain('https://www.w3.org/ns/activitystreams#Public');
	});

	test('renderAnnounce home', () => {
		const { service } = createService();
		const note = createNote({ visibility: 'home' });
		const result = service.renderAnnounce('https://remote.example/note', note);
		expect(result.to).toContain('https://example.com/users/user1/followers');
	});

	test('renderAnnounce followers', () => {
		const { service } = createService();
		const note = createNote({ visibility: 'followers' });
		const result = service.renderAnnounce('https://remote.example/note', note);
		expect(result.cc).toEqual([]);
	});

	test('renderAnnounce specified throws', () => {
		const { service } = createService();
		const note = createNote({ visibility: 'specified' });
		expect(() => service.renderAnnounce('obj', note)).toThrow();
	});

	test('renderBlock', () => {
		const { service } = createService();
		const block = { id: 'block1', blockerId: 'user1', blockee: { uri: 'https://remote.example/user' } } as Blocking;
		const result = service.renderBlock(block);
		expect(result.type).toBe('Block');
	});

	test('renderBlock throws without blockee uri', () => {
		const { service } = createService();
		const block = { id: 'block1', blockerId: 'user1', blockee: { uri: null } } as unknown as Blocking;
		expect(() => service.renderBlock(block)).toThrow();
	});

	test('renderCreate', () => {
		const { service } = createService();
		const result = service.renderCreate({ type: 'Note', to: ['public'], cc: [] } as any, createNote());
		expect(result.type).toBe('Create');
	});

	test('renderDelete', () => {
		const { service } = createService();
		const result = service.renderDelete({ type: 'Note' } as any, createLocalUser('user1'));
		expect(result.type).toBe('Delete');
	});

	test('renderDocument', () => {
		const { service, mocks } = createService();
		const file = { type: 'image/png', webpublicType: 'image/png', url: 'https://example.com/file.png', comment: 'pic' } as DriveFile;
		mocks.driveFileEntityService.getPublicUrl.mockReturnValue('https://example.com/file.png');
		const result = service.renderDocument(file);
		expect(result.type).toBe('Document');
		expect(result.url).toBe('https://example.com/file.png');
	});

	test('renderEmoji', () => {
		const { service } = createService();
		const emoji = { name: 'foo', updatedAt: new Date(), type: 'image/png', publicUrl: 'https://example.com/foo.png', originalUrl: '' } as Emoji;
		const result = service.renderEmoji(emoji);
		expect(result.type).toBe('Emoji');
		expect(result.name).toBe(':foo:');
	});

	test('renderEmoji uses originalUrl fallback and defaults type', () => {
		const { service } = createService();
		const emoji = { name: 'foo', updatedAt: null, type: null, publicUrl: null, originalUrl: 'https://example.com/foo.png' } as unknown as Emoji;
		const result = service.renderEmoji(emoji);
		expect(result.icon.url).toBe('https://example.com/foo.png');
		expect(result.icon.mediaType).toBe('image/png');
	});

	test('renderFlag', () => {
		const { service } = createService();
		const result = service.renderFlag(createLocalUser('user1'), 'https://remote.example/user', 'spam');
		expect(result.type).toBe('Flag');
	});

	test('renderFollow', () => {
		const { service } = createService();
		const result = service.renderFollow(createLocalUser('a'), createLocalUser('b'), 'req1');
		expect(result.type).toBe('Follow');
		expect(result.id).toBe('req1');
	});

	test('renderHashtag', () => {
		const { service } = createService();
		const result = service.renderHashtag('foo');
		expect(result.type).toBe('Hashtag');
		expect(result.name).toBe('#foo');
	});

	test('renderImage', () => {
		const { service } = createService();
		const result = service.renderImage({ comment: 'pic', isSensitive: true } as DriveFile);
		expect(result.type).toBe('Image');
		expect(result.sensitive).toBe(true);
	});

	test('renderKey', () => {
		const { service } = createService();
		const result = service.renderKey(createLocalUser('user1'), { publicKey: Buffer.from(testPublicKeyPem as string) } as any);
		expect(result.type).toBe('Key');
	});

	test('renderLike without custom emoji', async () => {
		const { service } = createService();
		const result = await service.renderLike({ id: 'reaction1', userId: 'user1', noteId: 'note1', reaction: '❤️' } as any, { uri: null });
		expect(result.type).toBe('Like');
	});

	test('renderLike with custom emoji', async () => {
		const { service, mocks } = createService();
		mocks.customEmojiService.localEmojisCache.fetch.mockResolvedValue(new Map([['foo', { name: 'foo', publicUrl: 'url', originalUrl: '', type: 'image/png', updatedAt: new Date(), localOnly: false } as Emoji]]));
		const result = await service.renderLike({ id: 'reaction1', userId: 'user1', noteId: 'note1', reaction: ':foo:' } as any, { uri: null });
		expect(result.tag).toBeDefined();
	});

	test('renderLike skips localOnly emoji', async () => {
		const { service, mocks } = createService();
		mocks.customEmojiService.localEmojisCache.fetch.mockResolvedValue(new Map([['foo', { name: 'foo', publicUrl: 'url', originalUrl: '', type: 'image/png', updatedAt: new Date(), localOnly: true } as Emoji]]));
		const result = await service.renderLike({ id: 'reaction1', userId: 'user1', noteId: 'note1', reaction: ':foo:' } as any, { uri: null });
		expect(result.tag).toBeUndefined();
	});

	test('renderLike falls back for unknown custom emoji', async () => {
		const { service, mocks } = createService();
		mocks.customEmojiService.localEmojisCache.fetch.mockResolvedValue(new Map());
		const result = await service.renderLike({ id: 'reaction1', userId: 'user1', noteId: 'note1', reaction: ':unknown:' } as any, { uri: null });
		expect(result.tag).toBeUndefined();
	});

	test('renderMention remote', () => {
		const { service, mocks } = createService();
		mocks.userEntityService.isRemoteUser.mockReturnValue(true);
		const result = service.renderMention({ id: 'user1', username: 'alice', host: 'remote.example' } as any);
		expect(result.type).toBe('Mention');
	});

	test('renderMove', () => {
		const { service } = createService();
		const result = service.renderMove(createLocalUser('a'), createLocalUser('b'));
		expect(result.type).toBe('Move');
	});

	test('renderQuestion', () => {
		const { service } = createService();
		const poll = { multiple: false, choices: ['a', 'b'], votes: [1, 2] } as Poll;
		const result = service.renderQuestion(createLocalUser('user1'), createNote(), poll);
		expect(result.type).toBe('Question');
	});

	test('renderReject', () => {
		const { service } = createService();
		const result = service.renderReject({ type: 'Follow' }, createLocalUser('user1'));
		expect(result.type).toBe('Reject');
	});

	test('renderRemove', () => {
		const { service } = createService();
		const result = service.renderRemove(createLocalUser('user1'), 'target', { type: 'Note' });
		expect(result.type).toBe('Remove');
	});

	test('renderTombstone', () => {
		const { service } = createService();
		const result = service.renderTombstone('https://example.com/notes/1');
		expect(result.type).toBe('Tombstone');
	});

	test('renderUndo with local id', () => {
		const { service } = createService();
		const result = service.renderUndo({ id: 'https://example.com/follows/1', type: 'Follow' } as any, createLocalUser('user1'));
		expect(result.type).toBe('Undo');
		expect(result.id).toBe('https://example.com/follows/1/undo');
	});

	test('renderUpdate', () => {
		const { service } = createService();
		const result = service.renderUpdate({ type: 'Person' } as any, createLocalUser('user1'));
		expect(result.type).toBe('Update');
	});

	test('renderVote', () => {
		const { service } = createService();
		const result = service.renderVote(createLocalUser('user1'), { id: 'vote1', choice: 0 } as any, { uri: 'https://remote.example/note' } as Note, { choices: ['a'] } as Poll, { uri: 'https://remote.example/user' } as any);
		expect(result.type).toBe('Create');
	});

	test('addContext adds id when missing', () => {
		const { service } = createService();
		const result = service.addContext({ type: 'Note' } as any);
		expect(result['@context']).toBeDefined();
		expect(result.id).toBeDefined();
	});

	test('addContext keeps existing id', () => {
		const { service } = createService();
		const result = service.addContext({ type: 'Note', id: 'https://example.com/notes/1' } as any);
		expect(result.id).toBe('https://example.com/notes/1');
	});

	test('attachLdSignature', async () => {
		const { service } = createService();
		const result = await service.attachLdSignature({ type: 'Create' }, createLocalUser('user1'));
		expect(result.signed).toBe(true);
	});

	test('renderOrderedCollectionPage with prev and next', () => {
		const { service } = createService();
		const result = service.renderOrderedCollectionPage('id', 10, [], 'partOf', 'prev', 'next');
		expect(result.prev).toBe('prev');
		expect(result.next).toBe('next');
	});

	test('renderOrderedCollectionPage without prev and next', () => {
		const { service } = createService();
		const result = service.renderOrderedCollectionPage('id', 10, [], 'partOf', undefined, undefined);
		expect(result.prev).toBeUndefined();
		expect(result.next).toBeUndefined();
	});

	test('renderOrderedCollection with all optional fields', () => {
		const { service } = createService();
		const result = service.renderOrderedCollection('id', 10, 'first', 'last', [{ type: 'Note' }] as any);
		expect(result.first).toBe('first');
		expect(result.last).toBe('last');
		expect(result.orderedItems).toHaveLength(1);
	});

	test('renderOrderedCollection without optional fields', () => {
		const { service } = createService();
		const result = service.renderOrderedCollection('id', 10, undefined, undefined, undefined);
		expect(result.first).toBeUndefined();
		expect(result.last).toBeUndefined();
		expect(result.orderedItems).toBeUndefined();
	});

	test('renderNote public with reply and quote', async () => {
		const { service, mocks } = createService();
		mocks.notesRepository.findOneBy.mockResolvedValueOnce({ id: 'reply1', userId: 'user2', uri: 'https://remote.example/reply1' } as Note);
		mocks.usersRepository.exist.mockResolvedValueOnce(true);
		mocks.notesRepository.findOneBy.mockResolvedValueOnce({ id: 'renote1', uri: 'https://remote.example/renote1' } as Note);
		const note = createNote({ replyId: 'reply1', renoteId: 'renote1' });

		const result = await service.renderNote(note);

		expect(result.type).toBe('Note');
		expect(result.inReplyTo).toBe('https://remote.example/reply1');
		expect(result._misskey_quote).toBe('https://remote.example/renote1');
	});

	test('renderPerson', async () => {
		const { service } = createService();
		const user = { ...createLocalUser('user1'), name: 'Alice', tags: [], emojis: [], avatarId: null, bannerId: null, movedToUri: null, alsoKnownAs: null } as LocalUser;
		const result = await service.renderPerson(user);
		expect(result.type).toBe('Person');
		expect(result.preferredUsername).toBe('useruser1');
	});

	test('renderPerson with optional fields', async () => {
		const { service, mocks } = createService();
		mocks.userProfilesRepository.findOneByOrFail.mockResolvedValue({
			description: 'bio',
			fields: [],
			birthday: '2000-01-01',
			location: 'Earth',
		});
		const user = {
			...createLocalUser('user1'),
			name: 'Alice',
			tags: ['cat'],
			emojis: ['foo'],
			avatarId: 'avatar1',
			bannerId: 'banner1',
			movedToUri: 'https://new.example/users/user1',
			alsoKnownAs: ['https://old.example/users/user1'],
			isCat: true,
		} as unknown as LocalUser;
		const result = await service.renderPerson(user);
		expect(result.movedTo).toBe('https://new.example/users/user1');
		expect(result.alsoKnownAs).toEqual(['https://old.example/users/user1']);
		expect(result['vcard:bday']).toBe('2000-01-01');
		expect(result['vcard:Address']).toBe('Earth');
	});

	test('renderNote followers visibility', async () => {
		const { service } = createService();
		const note = createNote({ visibility: 'followers' });

		const result = await service.renderNote(note);

		expect(result.to).toContain('https://example.com/users/user1/followers');
		expect(result.cc).not.toContain('https://www.w3.org/ns/activitystreams#Public');
	});

	test('renderNote specified visibility', async () => {
		const { service, mocks } = createService();
		mocks.usersRepository.findBy.mockResolvedValue([{ id: 'user2', username: 'bob', host: 'remote.example', uri: 'https://remote.example/user2' }] as any);
		const note = createNote({ visibility: 'specified', mentions: ['user2'], mentionedRemoteUsers: JSON.stringify([{ id: 'user2', uri: 'https://remote.example/user2' }]) });

		const result = await service.renderNote(note);

		expect(result.to).toContain('https://remote.example/user2');
		expect(result.cc).toEqual([]);
	});

	test('renderNote with files and emojis', async () => {
		const { service, mocks } = createService();
		mocks.driveFilesRepository.findBy.mockResolvedValue([{ id: 'file1', type: 'image/png', webpublicType: 'image/png', url: 'https://example.com/file.png', comment: 'pic' } as DriveFile]);
		mocks.customEmojiService.localEmojisCache.fetch.mockResolvedValue(new Map([['foo', { name: 'foo', publicUrl: 'url', originalUrl: '', type: 'image/png', updatedAt: new Date(), localOnly: false } as Emoji]]));
		const note = createNote({ fileIds: ['file1'], emojis: ['foo'] });

		const result = await service.renderNote(note);

		expect(result.attachment).toHaveLength(1);
		expect(result.tag).toBeDefined();
	});

	test('renderNote with open poll', async () => {
		const { service, mocks } = createService();
		mocks.pollsRepository.findOneBy.mockResolvedValue({ noteId: 'note1', multiple: true, choices: ['a', 'b'], votes: [1, 2], expiresAt: new Date(Date.now() + 86400000) } as Poll);
		const note = createNote({ hasPoll: true });

		const result = await service.renderNote(note);

		expect(result.type).toBe('Question');
		expect(result.oneOf).toBeUndefined();
		expect(result.anyOf).toBeDefined();
	});

	test('renderNote local reply without dive', async () => {
		const { service, mocks } = createService();
		mocks.notesRepository.findOneBy.mockResolvedValueOnce({ id: 'reply1', userId: 'user2', uri: null } as Note);
		mocks.usersRepository.exist.mockResolvedValueOnce(true);
		const note = createNote({ replyId: 'reply1' });

		const result = await service.renderNote(note, false);

		expect(result.inReplyTo).toBe('https://example.com/notes/reply1');
	});

	test('renderNote skips reply when reply user missing', async () => {
		const { service, mocks } = createService();
		mocks.notesRepository.findOneBy.mockResolvedValueOnce({ id: 'reply1', userId: 'user2', uri: 'https://remote.example/reply1' } as Note);
		mocks.usersRepository.exist.mockResolvedValueOnce(false);
		const note = createNote({ replyId: 'reply1' });

		const result = await service.renderNote(note);

		expect(result.inReplyTo).toBeUndefined();
	});

	test('renderNote with closed poll', async () => {
		const { service, mocks } = createService();
		mocks.pollsRepository.findOneBy.mockResolvedValue({ noteId: 'note1', multiple: false, choices: ['a'], votes: [5], expiresAt: new Date(Date.now() - 1000) } as Poll);
		const note = createNote({ hasPoll: true });

		const result = await service.renderNote(note);

		expect(result.type).toBe('Question');
		expect(result.closed).toBeDefined();
	});

	test('renderNote with multiple poll', async () => {
		const { service, mocks } = createService();
		mocks.pollsRepository.findOneBy.mockResolvedValue({ noteId: 'note1', multiple: true, choices: ['a', 'b'], votes: [1, 2], expiresAt: null } as Poll);
		const note = createNote({ hasPoll: true });

		const result = await service.renderNote(note);

		expect(result.anyOf).toHaveLength(2);
	});

	test('renderPerson as bot', async () => {
		const { service } = createService();
		const user = { ...createLocalUser('user1'), isBot: true, tags: [], emojis: [], avatarId: null, bannerId: null, movedToUri: null, alsoKnownAs: null } as LocalUser;
		const result = await service.renderPerson(user);
		expect(result.type).toBe('Service');
	});

	test('renderPerson as system', async () => {
		const { service } = createService();
		const user = { ...createLocalUser('user1'), username: 'system.user', tags: [], emojis: [], avatarId: null, bannerId: null, movedToUri: null, alsoKnownAs: null } as LocalUser;
		const result = await service.renderPerson(user);
		expect(result.type).toBe('Application');
	});

	test('renderPerson includes avatar and banner', async () => {
		const { service, mocks } = createService();
		mocks.driveFilesRepository.findOneBy.mockResolvedValueOnce({ id: 'avatar1', type: 'image/png', isSensitive: false } as DriveFile);
		mocks.driveFilesRepository.findOneBy.mockResolvedValueOnce({ id: 'banner1', type: 'image/png', isSensitive: false } as DriveFile);
		const user = { ...createLocalUser('user1'), avatarId: 'avatar1', bannerId: 'banner1', tags: [], emojis: [], movedToUri: null, alsoKnownAs: null } as LocalUser;

		const result = await service.renderPerson(user);

		expect(result.icon).toBeDefined();
		expect(result.image).toBeDefined();
	});

	test('renderPerson includes profile fields and birthday', async () => {
		const { service, mocks } = createService();
		mocks.userProfilesRepository.findOneByOrFail.mockResolvedValue({
			description: 'hello',
			fields: [{ name: 'Site', value: 'https://example.com' }],
			birthday: '2000-01-01',
			location: 'Japan',
		} as any);
		const user = { ...createLocalUser('user1'), tags: [], emojis: [], avatarId: null, bannerId: null, movedToUri: null, alsoKnownAs: null } as LocalUser;

		const result = await service.renderPerson(user);

		expect(result['vcard:bday']).toBe('2000-01-01');
		expect(result['vcard:Address']).toBe('Japan');
		expect(result.attachment).toHaveLength(1);
	});

	test('renderUndo without local id omits id', () => {
		const { service } = createService();
		const result = service.renderUndo({ id: 'https://remote.example/follow', type: 'Follow' } as any, createLocalUser('user1'));
		expect(result.id).toBeUndefined();
	});

	test('addContext keeps existing id', () => {
		const { service } = createService();
		const result = service.addContext({ id: 'https://example.com/existing', type: 'Note' } as any);
		expect(result.id).toBe('https://example.com/existing');
	});
});
