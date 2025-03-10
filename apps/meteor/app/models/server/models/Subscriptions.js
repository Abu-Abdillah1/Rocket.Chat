import { Meteor } from 'meteor/meteor';
import { Match } from 'meteor/check';
import mem from 'mem';

import { Base } from './_Base';
import Rooms from './Rooms';
import Users from './Users';
import { getDefaultSubscriptionPref } from '../../../utils/lib/getDefaultSubscriptionPref';

class Subscriptions extends Base {
	constructor(...args) {
		super(...args);

		this.tryEnsureIndex({ rid: 1 });
		this.tryEnsureIndex({ rid: 1, ls: 1 });
		this.tryEnsureIndex({ 'rid': 1, 'u._id': 1 }, { unique: 1 });
		this.tryEnsureIndex({ 'rid': 1, 'u._id': 1, 'open': 1 });
		this.tryEnsureIndex({ 'rid': 1, 'u.username': 1 });
		this.tryEnsureIndex({ 'rid': 1, 'alert': 1, 'u._id': 1 });
		this.tryEnsureIndex({ rid: 1, roles: 1 });
		this.tryEnsureIndex({ 'u._id': 1, 'name': 1, 't': 1 });
		this.tryEnsureIndex({ name: 1, t: 1 });
		this.tryEnsureIndex({ open: 1 });
		this.tryEnsureIndex({ alert: 1 });
		this.tryEnsureIndex({ ts: 1 });
		this.tryEnsureIndex({ ls: 1 });
		this.tryEnsureIndex({ desktopNotifications: 1 }, { sparse: 1 });
		this.tryEnsureIndex({ mobilePushNotifications: 1 }, { sparse: 1 });
		this.tryEnsureIndex({ emailNotifications: 1 }, { sparse: 1 });
		this.tryEnsureIndex({ autoTranslate: 1 }, { sparse: 1 });
		this.tryEnsureIndex({ autoTranslateLanguage: 1 }, { sparse: 1 });
		this.tryEnsureIndex({ 'userHighlights.0': 1 }, { sparse: 1 });
		this.tryEnsureIndex({ prid: 1 });
		this.tryEnsureIndex({ 'u._id': 1, 'open': 1, 'department': 1 });

		const collectionObj = this.model.rawCollection();
		this.distinct = Meteor.wrapAsync(collectionObj.distinct, collectionObj);
	}

	removeByVisitorToken(token) {
		const query = {
			'v.token': token,
		};

		this.remove(query);
	}

	changeDepartmentByRoomId(rid, department) {
		const query = {
			rid,
		};
		const update = {
			$set: {
				department,
			},
		};

		this.update(query, update);
	}

	// FIND ONE
	findOneByRoomIdAndUserId(roomId, userId, options = {}) {
		const query = {
			'rid': roomId,
			'u._id': userId,
		};

		return this.findOne(query, options);
	}

	findOneByRoomNameAndUserId(roomName, userId) {
		const query = {
			'name': roomName,
			'u._id': userId,
		};

		return this.findOne(query);
	}

	// FIND
	findByUserId(userId, options) {
		const query = { 'u._id': userId };

		return this.find(query, options);
	}

	cachedFindByUserId = mem(this.findByUserId.bind(this), { maxAge: 5000 });

	findByUserIdExceptType(userId, typeException, options) {
		const query = {
			'u._id': userId,
			't': { $ne: typeException },
		};

		return this.find(query, options);
	}

	findByUserIdAndRoomIds(userId, roomIds, options) {
		const query = {
			'u._id': userId,
			'rid': { $in: roomIds },
		};

		return this.find(query, options);
	}

	findByUserIdAndType(userId, type, options) {
		const query = {
			'u._id': userId,
			't': type,
		};

		return this.find(query, options);
	}

	findByUserIdAndTypes(userId, types, options) {
		const query = {
			'u._id': userId,
			't': {
				$in: types,
			},
		};

		return this.find(query, options);
	}

	/**
	 * @param {IUser['_id']} userId
	 * @param {IRole['_id'][]} roles
	 * @param {any} options
	 */
	findByUserIdAndRoles(userId, roles, options) {
		const query = {
			'u._id': userId,
			'roles': { $in: roles },
		};

		return this.find(query, options);
	}

	findByUserIdUpdatedAfter(userId, updatedAt, options) {
		const query = {
			'u._id': userId,
			'_updatedAt': {
				$gt: updatedAt,
			},
		};

		return this.find(query, options);
	}

	/**
	 * @param {string} roomId
	 * @param {IRole['_id'][]} roles the list of roles
	 * @param {any} options
	 */
	findByRoomIdAndRoles(roomId, roles, options = undefined) {
		roles = [].concat(roles);
		const query = {
			rid: roomId,
			roles: { $in: roles },
		};

		return this.find(query, options);
	}

	findByType(types, options) {
		const query = {
			t: {
				$in: types,
			},
		};

		return this.find(query, options);
	}

	findByTypeAndUserId(type, userId, options) {
		const query = {
			't': type,
			'u._id': userId,
		};

		return this.find(query, options);
	}

	findByRoomId(roomId, options) {
		const query = { rid: roomId };
		return this.find(query, options);
	}

	findByRoomIdAndNotUserId(roomId, userId, options = {}) {
		const query = {
			'rid': roomId,
			'u._id': {
				$ne: userId,
			},
		};

		return this.find(query, options);
	}

	findByRoomWithUserHighlights(roomId, options) {
		const query = {
			'rid': roomId,
			'userHighlights.0': { $exists: true },
		};

		return this.find(query, options);
	}

	getLastSeen(options = { fields: { _id: 0, ls: 1 } }) {
		options.sort = { ls: -1 };
		options.limit = 1;
		const [subscription] = this.find({}, options).fetch();
		return subscription?.ls;
	}

	findByRoomIdAndUserIds(roomId, userIds, options) {
		const query = {
			'rid': roomId,
			'u._id': {
				$in: userIds,
			},
		};

		return this.find(query, options);
	}

	findByRoomIdAndUserIdsOrAllMessages(roomId, userIds) {
		const query = {
			rid: roomId,
			$or: [{ 'u._id': { $in: userIds } }, { emailNotifications: 'all' }],
		};

		return this.find(query);
	}

	findByRoomIdWhenUserIdExists(rid, options) {
		const query = { rid, 'u._id': { $exists: 1 } };

		return this.find(query, options);
	}

	findByRoomIdWhenUsernameExists(rid, options) {
		const query = { rid, 'u.username': { $exists: 1 } };

		return this.find(query, options);
	}

	findUnreadByUserId(userId) {
		const query = {
			'u._id': userId,
			'unread': {
				$gt: 0,
			},
		};

		return this.find(query, { fields: { unread: 1 } });
	}

	getMinimumLastSeenByRoomId(rid) {
		return this.db.findOne(
			{
				rid,
			},
			{
				sort: {
					ls: 1,
				},
				fields: {
					ls: 1,
				},
			},
		);
	}

	// UPDATE
	archiveByRoomId(roomId) {
		const query = { rid: roomId };

		const update = {
			$set: {
				alert: false,
				open: false,
				archived: true,
			},
		};

		return this.update(query, update, { multi: true });
	}

	unarchiveByRoomId(roomId) {
		const query = { rid: roomId };

		const update = {
			$set: {
				alert: false,
				open: true,
				archived: false,
			},
		};

		return this.update(query, update, { multi: true });
	}

	hideByRoomIdAndUserId(roomId, userId) {
		const query = {
			'rid': roomId,
			'u._id': userId,
		};

		const update = {
			$set: {
				alert: false,
				open: false,
			},
		};

		return this.update(query, update);
	}

	openByRoomIdAndUserId(roomId, userId) {
		const query = {
			'rid': roomId,
			'u._id': userId,
		};

		const update = {
			$set: {
				open: true,
			},
		};

		return this.update(query, update);
	}

	setAsUnreadByRoomIdAndUserId(roomId, userId, firstMessageUnreadTimestamp) {
		const query = {
			'rid': roomId,
			'u._id': userId,
		};

		const update = {
			$set: {
				open: true,
				alert: true,
				ls: firstMessageUnreadTimestamp,
			},
		};

		return this.update(query, update);
	}

	setCustomFieldsDirectMessagesByUserId(userId, fields) {
		const query = {
			'u._id': userId,
			't': 'd',
		};
		const update = { $set: { customFields: fields } };
		const options = { multi: true };

		return this.update(query, update, options);
	}

	updateNameAndAlertByRoomId(roomId, name, fname) {
		const query = { rid: roomId };

		const update = {
			$set: {
				name,
				fname,
				alert: true,
			},
		};

		return this.update(query, update, { multi: true });
	}

	updateDisplayNameByRoomId(roomId, fname) {
		const query = { rid: roomId };

		const update = {
			$set: {
				fname,
				name: fname,
			},
		};

		return this.update(query, update, { multi: true });
	}

	updateFnameByRoomId(rid, fname) {
		const query = { rid };

		const update = {
			$set: {
				fname,
			},
		};

		return this.update(query, update, { multi: true });
	}

	updateNameAndFnameById(_id, name, fname) {
		const query = { _id };

		const update = {
			$set: {
				name,
				fname,
			},
		};

		return this.update(query, update, { multi: true });
	}

	setUserUsernameByUserId(userId, username) {
		const query = { 'u._id': userId };

		const update = {
			$set: {
				'u.username': username,
			},
		};

		return this.update(query, update, { multi: true });
	}

	setNameForDirectRoomsWithOldName(oldName, name) {
		const query = {
			name: oldName,
			t: 'd',
		};

		const update = {
			$set: {
				name,
			},
		};

		return this.update(query, update, { multi: true });
	}

	updateDirectNameAndFnameByName(name, newName, newFname) {
		const query = {
			name,
			t: 'd',
		};

		const update = {
			$set: {
				...(newName && { name: newName }),
				...(newFname && { fname: newFname }),
			},
		};

		return this.update(query, update, { multi: true });
	}

	incUnreadForRoomIdExcludingUserIds(roomId, userIds, inc) {
		if (inc == null) {
			inc = 1;
		}
		const query = {
			'rid': roomId,
			'u._id': {
				$nin: userIds,
			},
		};

		const update = {
			$set: {
				alert: true,
				open: true,
			},
			$inc: {
				unread: inc,
			},
		};

		return this.update(query, update, { multi: true });
	}

	incGroupMentionsAndUnreadForRoomIdExcludingUserId(roomId, userId, incGroup = 1, incUnread = 1) {
		const query = {
			'rid': roomId,
			'u._id': {
				$ne: userId,
			},
		};

		const update = {
			$set: {
				alert: true,
				open: true,
			},
			$inc: {
				unread: incUnread,
				groupMentions: incGroup,
			},
		};

		return this.update(query, update, { multi: true });
	}

	incUserMentionsAndUnreadForRoomIdAndUserIds(roomId, userIds, incUser = 1, incUnread = 1) {
		const query = {
			'rid': roomId,
			'u._id': {
				$in: userIds,
			},
		};

		const update = {
			$set: {
				alert: true,
				open: true,
			},
			$inc: {
				unread: incUnread,
				userMentions: incUser,
			},
		};

		return this.update(query, update, { multi: true });
	}

	ignoreUser({ _id, ignoredUser: ignored, ignore = true }) {
		const query = {
			_id,
		};
		const update = {};
		if (ignore) {
			update.$addToSet = { ignored };
		} else {
			update.$pull = { ignored };
		}

		return this.update(query, update);
	}

	setAlertForRoomIdExcludingUserId(roomId, userId) {
		const query = {
			'rid': roomId,
			'u._id': {
				$ne: userId,
			},
			'alert': { $ne: true },
		};

		const update = {
			$set: {
				alert: true,
			},
		};
		return this.update(query, update, { multi: true });
	}

	setOpenForRoomIdExcludingUserId(roomId, userId) {
		const query = {
			'rid': roomId,
			'u._id': {
				$ne: userId,
			},
			'open': { $ne: true },
		};

		const update = {
			$set: {
				open: true,
			},
		};
		return this.update(query, update, { multi: true });
	}

	setAlertForRoomIdAndUserIds(roomId, uids) {
		const query = {
			'rid': roomId,
			'u._id': { $in: uids },
			'alert': { $ne: true },
		};

		const update = {
			$set: {
				alert: true,
			},
		};
		return this.update(query, update, { multi: true });
	}

	setOpenForRoomIdAndUserIds(roomId, uids) {
		const query = {
			'rid': roomId,
			'u._id': { $in: uids },
			'open': { $ne: true },
		};

		const update = {
			$set: {
				open: true,
			},
		};
		return this.update(query, update, { multi: true });
	}

	setLastReplyForRoomIdAndUserIds(roomId, uids, lr) {
		const query = {
			'rid': roomId,
			'u._id': { $in: uids },
		};

		const update = {
			$set: {
				lr,
			},
		};
		return this.update(query, update, { multi: true });
	}

	setBlockedByRoomId(rid, blocked, blocker) {
		const query = {
			rid,
			'u._id': blocked,
		};

		const update = {
			$set: {
				blocked: true,
			},
		};

		const query2 = {
			rid,
			'u._id': blocker,
		};

		const update2 = {
			$set: {
				blocker: true,
			},
		};

		return this.update(query, update) && this.update(query2, update2);
	}

	unsetBlockedByRoomId(rid, blocked, blocker) {
		const query = {
			rid,
			'u._id': blocked,
		};

		const update = {
			$unset: {
				blocked: 1,
			},
		};

		const query2 = {
			rid,
			'u._id': blocker,
		};

		const update2 = {
			$unset: {
				blocker: 1,
			},
		};

		return this.update(query, update) && this.update(query2, update2);
	}

	updateCustomFieldsByRoomId(rid, cfields) {
		const query = { rid };
		const customFields = cfields || {};
		const update = {
			$set: {
				customFields,
			},
		};

		return this.update(query, update, { multi: true });
	}

	updateTypeByRoomId(roomId, type) {
		const query = { rid: roomId };

		const update = {
			$set: {
				t: type,
			},
		};

		return this.update(query, update, { multi: true });
	}

	setArchivedByUsername(username, archived) {
		const query = {
			t: 'd',
			name: username,
		};

		const update = {
			$set: {
				archived,
			},
		};

		return this.update(query, update, { multi: true });
	}

	clearNotificationUserPreferences(userId, notificationField, notificationOriginField) {
		const query = {
			'u._id': userId,
			[notificationOriginField]: 'user',
		};

		const update = {
			$unset: {
				[notificationOriginField]: 1,
				[notificationField]: 1,
			},
		};

		return this.update(query, update, { multi: true });
	}

	updateNotificationUserPreferences(userId, userPref, notificationField, notificationOriginField) {
		const query = {
			'u._id': userId,
			[notificationOriginField]: {
				$ne: 'subscription',
			},
		};

		const update = {
			$set: {
				[notificationField]: userPref,
				[notificationOriginField]: 'user',
			},
		};

		return this.update(query, update, { multi: true });
	}

	updateUserHighlights(userId, userHighlights) {
		const query = {
			'u._id': userId,
		};

		const update = {
			$set: {
				userHighlights,
			},
		};

		return this.update(query, update, { multi: true });
	}

	updateDirectFNameByName(name, fname) {
		const query = {
			t: 'd',
			name,
		};

		let update;
		if (fname) {
			update = {
				$set: {
					fname,
				},
			};
		} else {
			update = {
				$unset: {
					fname: true,
				},
			};
		}

		return this.update(query, update, { multi: true });
	}

	// INSERT
	createWithRoomAndUser(room, user, extraData) {
		const subscription = {
			open: false,
			alert: false,
			unread: 0,
			userMentions: 0,
			groupMentions: 0,
			ts: room.ts,
			rid: room._id,
			name: room.name,
			fname: room.fname,
			customFields: room.customFields,
			t: room.t,
			u: {
				_id: user._id,
				username: user.username,
				name: user.name,
			},
			...getDefaultSubscriptionPref(user),
			...extraData,
		};

		if (room.prid) {
			subscription.prid = room.prid;
		}

		const result = this.insert(subscription);

		Rooms.incUsersCountById(room._id);

		if (!['d', 'l'].includes(room.t)) {
			Users.addRoomByUserId(user._id, room._id);
		}

		return result;
	}

	// REMOVE
	removeByUserId(userId) {
		const query = {
			'u._id': userId,
		};

		const roomIds = this.findByUserId(userId).map((s) => s.rid);

		const result = this.remove(query);

		if (Match.test(result, Number) && result > 0) {
			Rooms.incUsersCountNotDMsByIds(roomIds, -1);
		}

		Users.removeAllRoomsByUserId(userId);

		return result;
	}

	removeByRoomId(roomId) {
		const query = {
			rid: roomId,
		};

		const result = this.remove(query);

		if (Match.test(result, Number) && result > 0) {
			Rooms.incUsersCountById(roomId, -result);
		}

		Users.removeRoomByRoomId(roomId);

		return result;
	}

	removeByRoomIdAndUserId(roomId, userId) {
		const query = {
			'rid': roomId,
			'u._id': userId,
		};

		const result = this.remove(query);

		if (Match.test(result, Number) && result > 0) {
			Rooms.incUsersCountById(roomId, -result);
		}

		Users.removeRoomByUserId(userId, roomId);

		return result;
	}

	removeByRoomIds(rids) {
		const result = this.remove({ rid: { $in: rids } });

		Users.removeRoomByRoomIds(rids);

		return result;
	}

	removeByRoomIdsAndUserId(rids, userId) {
		const result = this.remove({ 'rid': { $in: rids }, 'u._id': userId });

		if (Match.test(result, Number) && result > 0) {
			Rooms.incUsersCountByIds(rids, -1);
		}

		Users.removeRoomsByRoomIdsAndUserId(rids, userId);

		return result;
	}

	// //////////////////////////////////////////////////////////////////
	// threads

	addUnreadThreadByRoomIdAndUserIds(rid, users, tmid, { groupMention = false, userMention = false } = {}) {
		if (!users) {
			return;
		}

		return this.update(
			{
				'u._id': { $in: users },
				rid,
			},
			{
				$addToSet: {
					tunread: tmid,
					...(groupMention && { tunreadGroup: tmid }),
					...(userMention && { tunreadUser: tmid }),
				},
			},
			{ multi: true },
		);
	}

	removeUnreadThreadByRoomIdAndUserId(rid, userId, tmid, clearAlert = false) {
		const update = {
			$pull: {
				tunread: tmid,
				tunreadGroup: tmid,
				tunreadUser: tmid,
			},
		};

		if (clearAlert) {
			update.$set = { alert: false };
		}

		return this.update(
			{
				'u._id': userId,
				rid,
			},
			update,
		);
	}

	removeUnreadThreadsByRoomId(rid, tunread) {
		const query = {
			rid,
			tunread: { $in: tunread },
		};

		const update = {
			$pullAll: {
				tunread,
				tunreadUser: tunread,
				tunreadGroup: tunread,
			},
		};

		return this.update(query, update, { multi: true });
	}
}

export default new Subscriptions('subscription', true);
