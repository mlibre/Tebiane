class Users
{
	constructor ()
	{
		this.users = {};
	}

	addUser ( userId, userInfo )
	{
		this.users[userId] = userInfo;
	}

	getUser ( userId )
	{
		return this.users[userId];
	}

	updateUser ( userId, updatedInfo )
	{
		if ( this.users[userId] )
		{
			this.users[userId] = { ...this.users[userId], ...updatedInfo };
		}
	}

	removeUser ( userId )
	{
		delete this.users[userId];
	}
}

const users = new Users();
module.exports = users
