import { Random } from '@rocket.chat/random';
import { UserBridge } from '@rocket.chat/apps-engine/server/bridges/UserBridge';
import type { IUserCreationOptions, IUser, UserType } from '@rocket.chat/apps-engine/definition/users';
import { Subscriptions, Users as UsersRaw } from '@rocket.chat/models';

import { setUserAvatar, deleteUser, getUserCreatedByApp } from '../../../lib/server/functions';
import { checkUsernameAvailability } from '../../../lib/server/functions/checkUsernameAvailability';
import { Users } from '../../../models/server';
import type { AppServerOrchestrator } from '../../../../ee/server/apps/orchestrator';

export class AppUserBridge extends UserBridge {
	// eslint-disable-next-line no-empty-function
	constructor(private readonly orch: AppServerOrchestrator) {
		super();
	}

	protected async getById(userId: string, appId: string): Promise<IUser> {
		this.orch.debugLog(`The App ${appId} is getting the userId: "${userId}"`);

		return this.orch.getConverters()?.get('users').convertById(userId);
	}

	protected async getByUsername(username: string, appId: string): Promise<IUser> {
		this.orch.debugLog(`The App ${appId} is getting the username: "${username}"`);

		return this.orch.getConverters()?.get('users').convertByUsername(username);
	}

	protected async getAppUser(appId?: string): Promise<IUser | undefined> {
		this.orch.debugLog(`The App ${appId} is getting its assigned user`);

		const user = Users.findOneByAppId(appId, {});

		return this.orch.getConverters()?.get('users').convertToApp(user);
	}

	/**
	 * Deletes all bot or app users created by the App.
	 * @param appId the App's ID.
	 * @param type the type of the user to be deleted.
	 * @returns true if any user was deleted, false otherwise.
	 */
	protected async deleteUsersCreatedByApp(appId: string, type: UserType.APP | UserType.BOT): Promise<boolean> {
		this.orch.debugLog(`The App ${appId} is deleting all bot users`);

		const appUsers = await getUserCreatedByApp(appId, type);
		if (appUsers.length) {
			this.orch.debugLog(`The App ${appId} is deleting ${appUsers.length} users`);
			await Promise.all(appUsers.map((appUser) => deleteUser(appUser._id)));
			return true;
		}
		return false;
	}

	protected async create(userDescriptor: Partial<IUser>, appId: string, options?: IUserCreationOptions): Promise<string> {
		this.orch.debugLog(`The App ${appId} is requesting to create a new user.`);
		const user = this.orch.getConverters()?.get('users').convertToRocketChat(userDescriptor);

		if (!user._id) {
			user._id = Random.id();
		}

		if (!user.createdAt) {
			user.createdAt = new Date();
		}

		switch (user.type) {
			case 'bot':
			case 'app':
				if (!(await checkUsernameAvailability(user.username))) {
					throw new Error(`The username "${user.username}" is already being used. Rename or remove the user using it to install this App`);
				}

				Users.insert(user);

				if (options?.avatarUrl) {
					setUserAvatar(user, options.avatarUrl, '', 'local');
				}

				break;

			default:
				throw new Error('Creating normal users is currently not supported');
		}

		return user._id;
	}

	protected async remove(user: IUser & { id: string }, appId: string): Promise<boolean> {
		this.orch.debugLog(`The App's user is being removed: ${appId}`);

		// It's actually not a problem if there is no App user to delete - just means we don't need to do anything more.
		if (!user) {
			return true;
		}

		try {
			await deleteUser(user.id);
		} catch (err) {
			throw new Error(`Errors occurred while deleting an app user: ${err}`);
		}

		return true;
	}

	protected async update(
		user: IUser & { id: string },
		fields: Partial<IUser> & { statusDefault: string },
		appId: string,
	): Promise<boolean> {
		this.orch.debugLog(`The App ${appId} is updating a user`);

		if (!user) {
			throw new Error('User not provided');
		}

		if (!Object.keys(fields).length) {
			return true;
		}

		const { status } = fields;
		delete fields.status;

		if (status) {
			fields.statusDefault = status;
		}

		await UsersRaw.updateOne({ _id: user.id }, { $set: fields as any });

		return true;
	}

	protected async getActiveUserCount(): Promise<number> {
		return Users.getActiveLocalUserCount();
	}

	protected async getUserUnreadMessageCount(uid: string): Promise<number> {
		return Subscriptions.getBadgeCount(uid);
	}
}
